import { gray, yellow } from "jsr:@std/fmt/colors";
import denoConfig from "./deno.json" with { type: "json" };
import Init from "./options/init.ts";
import Install from "./options/install.ts";
import Build from "./options/build.ts";

const args = Deno.args.map((a) => a.toLowerCase());

const prefix = gray("[Despace]");

console.warn(
	`${prefix} ${
		yellow(
			"Despace is now deprecated in favor of Deno's built in workspace support.",
		)
	}`,
);

switch (args[0]) {
	case "init": {
		await Init(args);
		break;
	}

	case "build": {
		await Build(args);
		break;
	}

	case "help": {
		console.log(
			`${prefix} Available commands: \n\t `,
			[
				"init [file | --make] - Initialize Despace in the current directory.",
				"build [--watch] - Build the current project.",
				"update - Update to the latest version of Despace.",
				"version - Display the current version of Despace.",
				"help - Display this message.",
			].join("\n\t  "),
		);
		break;
	}

	case "update":
	case "install": {
		await Install(args);
		break;
	}

	default: {
		if (args[0] != undefined && args[0] != "version") {
			console.error(
				`${prefix} Unknown command \`${
					args[0]
				}\`, run \`despace help\` for a list of commands.`,
			);
		} else {
			console.log(`${prefix} Running version ${denoConfig.version}`);
		}
		break;
	}
}
