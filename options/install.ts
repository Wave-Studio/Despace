import { prefix } from "../common.ts";
import { green, red } from "jsr:@std/fmt/colors";

export default async function Install(_args: string[]) {
	console.log(`${prefix} Requesting permissions to run installer...`);
	const permissionStatus = await Deno.permissions.request({
		name: "run",
	});

	if (permissionStatus.state != "granted") {
		console.log(
			`${prefix} ${red("Permissions were denied, unable to continue.")}`,
		);
	} else {
		console.log(
			`${prefix} Installing the latest version of Despace...`,
		);
		const cmd = new Deno.Command(Deno.execPath(), {
			args: [
				"install",
				// Deno install flags
				"--global",
				"--force",
				"--reload=jsr:@studios/despace",
				"--name=despace",

				// Despace permissions
				"--allow-read",
				"--allow-write",

				// Despace CLI
				"jsr:@studios/despace",
			],
		});

		const { success, stderr } = await cmd.output();

		if (success) {
			console.log(`${prefix} ${green("Despace has been updated!")}`);
		} else {
			console.error(
				`${prefix} ${red("An error occurred while installing:")}`,
			);
			console.error(stderr);
			Deno.exit(1);
		}
	}
}
