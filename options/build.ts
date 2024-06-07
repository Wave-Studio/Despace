import { parse } from "jsr:@std/jsonc";
import { prefix } from "../common.ts";
import { green, red, yellow } from "jsr:@std/fmt/colors";
import { join, normalize, relative } from "jsr:@std/path";

export default async function Build(args: string[]) {
	const cwd = Deno.cwd();
	const shouldWatch = args[1] == "--watch";
	let despaceConfig: {
		"despace.configSource": string;
		"despace.prependJSR": boolean;
	};

	try {
		const config = await Deno.readTextFile(
			join(cwd, "./.despace/config.json"),
		);

		despaceConfig = JSON.parse(config);
	} catch (e) {
		if (e instanceof Deno.errors.NotFound) {
			console.error(
				`${prefix} ${
					red("Despace is not initialized in this directory! Run `despace init` before using this command.")
				}`,
			);
			Deno.exit(1);
		} else {
			console.error(
				`${prefix} ${
					red("An error occurred while trying to read despace.json:")
				}`,
			);
			console.error(e);
			Deno.exit(1);
		}
	}

	const config = parse(
		await Deno.readTextFile(
			join(cwd, despaceConfig["despace.configSource"]),
		),
		{
			allowTrailingComma: true,
		},
	) as Record<string, unknown>;

	if (!Object.hasOwn(config, "workspaces")) {
		console.warn(`${prefix} ${yellow("No workspaces found in config.")}`);
		Deno.exit(0);
	}

	const imports: { name: string; path: string }[] = [];

	const recursivelyMapWorkspaces = async (path: string) => {
		let foundFile = false;

		for (const configFile of ["deno.json", "deno.jsonc"]) {
			try {
				const contents = await Deno.readTextFile(
					join(path, configFile),
				);
				const parsed = parse(contents, {
					allowTrailingComma: true,
				}) as {
					name?: string;
					exports?: string | Record<string, string>;
					workspaces?: string[];
				};

				foundFile = true;

				if (parsed.name == undefined) {
					console.warn(
						`${prefix} No name found in ${
							relative(
								cwd,
								join(path, configFile),
							)
						}.`,
					);
					continue;
				}

				if (parsed.exports == undefined) {
					console.warn(
						`${prefix} ${
							yellow(`No exports found in ${config.name}.`)
						}`,
					);
					continue;
				}

				// Only 1 export
				if (typeof parsed.exports == "string") {
					imports.push({
						name: parsed.name,
						path: normalize(
							relative(
								cwd,
								join(path, parsed.exports as string),
							),
						),
					});
				} else {
					// Multiple exports
					for (
						const [name, filePath] of Object.entries(
							parsed.exports as Record<string, string>,
						)
					) {
						imports.push({
							name: join(parsed.name as string, name),
							path: normalize(
								relative(
									cwd,
									join(path, filePath),
								),
							),
						});
					}
				}

				if (parsed.workspaces != undefined) {
					for (const workspace of parsed.workspaces) {
						await recursivelyMapWorkspaces(join(path, workspace));
					}
				}
			} catch (e) {
				if (e instanceof Deno.errors.NotFound) {
					continue;
				} else {
					console.error(
						`${prefix} ${
							red(
								`An error occurred while trying to read ${
									relative(
										cwd,
										join(path, configFile),
									)
								}:`,
							)
						}`,
					);
					console.error(e);
					Deno.exit(1);
				}
			}
		}

		if (!foundFile) {
			console.warn(
				`${prefix} ${
					yellow(
						`No deno.json or deno.jsonc found in ${
							relative(cwd, path)
						}.`,
					)
				}`,
			);
		}
	};

	for (const workspace of config.workspaces as string[]) {
		await recursivelyMapWorkspaces(join(cwd, workspace));
	}

	const newImportMap = {
		imports: Object.fromEntries(
			[
				...imports.map((
					i,
				) => [
					despaceConfig["despace.prependJSR"]
						? `jsr:${i.name}`
						: i.name,
					i.path,
				]),
				...Object.entries(
					config["despace.imports"] as Record<string, string>,
				),
			],
		),
		scopes: config["despace.scopes"],
	};

	await Deno.writeTextFile(
		join(cwd, "./.despace/imports.json"),
		JSON.stringify(newImportMap, null, 4),
	);

	console.log(`${prefix} ${green("Successfully built project.")}`);

	if (shouldWatch) {
		console.log(`${prefix} Watching for changes...`);
		const watcher = Deno.watchFs(cwd, {
			recursive: true,
		});

		let timeoutID: number | undefined;

		for await (const event of watcher) {
			if (["modify", "create", "remove"].includes(event.kind)) {
				for (const file of event.paths) {
					const path = relative(cwd, file);
					if (
						path.startsWith(".despace") ||
						path.endsWith("deno.jsonc") ||
						path.endsWith("deno.json") ||
						path == despaceConfig["despace.configSource"]
					) {
						if (timeoutID != undefined) {
							clearTimeout(timeoutID);
						}

						timeoutID = setTimeout(async () => {
							console.log(
								`${prefix} Detected file change. Rebuilding...`,
							);
							watcher.close();
							await Build(args);
						}, 500);
					}
				}
			}
		}
	}
}
