import { prefix } from "../common.ts";
import { extname, join } from "jsr:@std/path";
import { parse } from "jsr:@std/jsonc";
import { red } from "jsr:@std/fmt/colors";

export default async function Init(args: string[]) {
	const cwd = Deno.cwd();

	try {
		await Deno.readTextFile(join(cwd, "./.despace/config.json"));
		throw new Error("Despace");
	} catch (e) {
		if (!(e instanceof Deno.errors.NotFound)) {
			if (e instanceof Error && e.message == "Despace") {
				console.error(
					`${prefix} ${
						red("Despace is already initialized in this directory!")
					}`,
				);
				Deno.exit(1);
			} else {
				console.error(
					`${prefix} ${
						red(`An error occured while trying to check if Despace is initialized:`)
					}`,
				);
				console.error(e);
				Deno.exit(1);
			}
		}
	}

	const shouldMakeCustomConfig = args[2] == "--make";

	const filesToLookFor = args[2] != undefined
		? [args[2]]
		: ["deno.json", "deno.jsonc"];

	if (filesToLookFor.length < 2) {
		if (shouldMakeCustomConfig) {
			console.log(`${prefix} Creating config file...`);
		} else {
			console.log(
				`${prefix} Checking for manually specified file only...`,
			);
		}
	} else {
		console.log(`${prefix} Checking for default deno configs...`);
	}

	let config: { name: string | undefined; contents: string | undefined } =
		shouldMakeCustomConfig
			? {
				name: "deno.jsonc",
				"contents": "",
			}
			: {
				name: undefined,
				contents: undefined,
			};

	for (const file of filesToLookFor) {
		if (config.name == undefined) {
			try {
				const contents = await Deno.readTextFile(join(cwd, file));

				config = {
					name: file,
					contents,
				};
			} catch (e) {
				if (e instanceof Deno.errors.NotFound) {
					continue;
				} else {
					console.error(
						`${prefix} ${
							red(`An error occured while trying to read ${file}:`)
						}`,
					);
					console.error(e);
					Deno.exit(1);
				}
			}
		}
	}

	if (config.name == undefined) {
		console.error(
			`${prefix} ${red("No deno configuration files found.")}`,
		);
		console.error(
			"\t  Either create a deno.json(c) file, specify one with `despace init <config>`, or use `despace init --make` to create a config file",
		);
	}

	const ext = extname(config.name!).substring(1);

	if (!shouldMakeCustomConfig) {
		console.log(`${prefix} Found ${ext} file: ${config.name}`);

		if (ext == "jsonc") {
			console.log(
				`${prefix} JSONC detected, unfortunately JSONC can't be written to currently and as such you will be required to append the necessary fields manually.`,
			);
		}
	}

	const parsedConfig = parse(config.contents!, {
		allowTrailingComma: true,
	}) as Record<string, unknown>;

	const newFields = {
		importMap: "./.despace/imports.json",
		"_despace.comment":
			"Utilize this for any sort of imports, Despace will automatically manage this for you.",
		// Should fix any sort of jankness from trying to pull directly from the config
		"despace.imports": JSON.parse(
			JSON.stringify(parsedConfig?.imports ?? {}),
		),
		"despace.scopes": JSON.parse(
			JSON.stringify(parsedConfig?.scopes ?? {}),
		),
		tasks: {
			"despace:build": "despace build",
			"despace:dev": "despace build --watch",
			"despace:update": "despace update",
			"despace:install": "deno run jsr:@studios/despace",
		},
	};

	if (parsedConfig.importMap != undefined) {
		const oldImportMap = parse(
			await Deno.readTextFile(
				join(cwd, parsedConfig.importMap as string),
			),
			{
				allowTrailingComma: true,
			},
		) as {
			imports?: Record<string, string>;
			scopes?: Record<string, Record<string, string>>;
		};

		if (oldImportMap.imports != undefined) {
			newFields["despace.imports"] = {
				...newFields["despace.imports"],
				...oldImportMap.imports,
			};
		}

		if (oldImportMap.scopes != undefined) {
			newFields["despace.scopes"] = {
				...newFields["despace.scopes"],
				...oldImportMap.scopes,
			};
		}
	}

	const configFile = {
		"despace.configSource": config.name,
		"despace.prependJSR": false,
	};

	const importMap = {
		"imports": {},
	};

	await Deno.mkdir(join(cwd, ".despace"), { recursive: true });

	await Deno.writeTextFile(
		join(cwd, ".despace", "imports.json"),
		JSON.stringify(importMap, null, 4),
	);

	await Deno.writeTextFile(
		join(cwd, ".despace", "config.json"),
		JSON.stringify(configFile, null, 4),
	);

	if (shouldMakeCustomConfig) {
		await Deno.writeTextFile(
			"./deno.jsonc",
			JSON.stringify(newFields, null, 4),
		);
	} else {
		if (ext == "json") {
			const oldConfigLocation =
				config.name!.substring(0, config.name!.lastIndexOf(".")) +
				".old." + ext;

			await Deno.rename(
				join(cwd, config.name!),
				join(
					cwd,
					oldConfigLocation,
				),
			);

			console.log(
				`${prefix} A backup of your original configuration file has been created at ${oldConfigLocation}! ` +
					`You can delete this file once you have confirmed that installation was successful.`,
			);

			delete parsedConfig.imports;
			delete parsedConfig.scopes;

			if (parsedConfig.tasks != undefined) {
				parsedConfig.tasks = {
					...parsedConfig.tasks,
					...newFields.tasks,
				};

				// @ts-expect-error I don't want to have to manually declare types for this one line to not error
				delete newFields.tasks;
			}

			await Deno.writeTextFile(
				join(cwd, config.name!),
				JSON.stringify(
					{
						...parsedConfig,
						...newFields,
					},
					null,
					4,
				),
			);

			console.log(
				`${prefix} Successfully imported Despace into ${config.name}! You can now run \`despace build\` to utilize Despace.`,
			);
		} else {
			// JSONC
			await Deno.writeTextFile(
				join(cwd, "deno.part.jsonc"),
				JSON.stringify(newFields, null, 4),
			);
			console.log(
				`${prefix} Generated files for Despace in JSONC format. The following is how you can import Despace into your configuration file: \nt `,
				[
					"- Copy the contents of \`deno.part.jsonc\` into your config file.",
					"- Transfer the contents of \`imports\` inside your config file to \`despace.imports\` and remove the \`imports\` field.",
					"- Run \`despace build\` to utilize Despace.",
				].join("\n\t  "),
			);
		}
	}
}
