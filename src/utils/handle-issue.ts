import { KnownError } from "../app/errors.ts";

import { Datex } from "datex-core-legacy";
import { ESCAPE_SEQUENCES } from "datex-core-legacy/utils/logger.ts";

import DATEX_VERSION from "datex-core-legacy/VERSION.ts"
import { version as UIX_VERSION } from "./version.ts";
import { sendReport } from "datex-core-legacy/utils/error-reporting.ts";

const ESCAPE_SEQUENCE_NORMAL_INTENSITY = "\x1b[22m";

/**
 * Formats and prints an error in a fashion that's readable and informative
 * for the user. If `exit` is enabled, the process exits afterwards.
 * @param error The error object to handle
 * @param logger Logger to print the information to
 * @param [exit=true] Specifies whether the process should exit, defaults to `true`
 * @param [exitCode=1] Code to exit with if `exit` is set to true, defaults to `1`
 */
export async function handleError(error: Error, logger: Datex.Logger, exit = true, exitCode = 1) {
	if (error instanceof KnownError) {
		if (error.solutions.length > 0) {
			logger.info(`Suggested Problem Solutions\n${error.solutions.map(s => `- ${s}`).join("\n")}`);
			console.log();
		}
		logger.error(error.message);
	} else {
		let details;
		if (error.stack) {
			const stack = error.stack.split("\n");
			stack[0] = `${ESCAPE_SEQUENCES.UNDERLINE}${stack[0]}${ESCAPE_SEQUENCES.RESET_UNDERLINE}`;
			details = stack.join("\n");
		} else details = error.toString();

		logger.error(`An unexpected error occured.\n${ESCAPE_SEQUENCES.BOLD}UIX${ESCAPE_SEQUENCE_NORMAL_INTENSITY} Version: ${UIX_VERSION}\n${ESCAPE_SEQUENCES.BOLD}DATEX${ESCAPE_SEQUENCE_NORMAL_INTENSITY} Version: ${DATEX_VERSION}\n${ESCAPE_SEQUENCES.BOLD}Deno${ESCAPE_SEQUENCE_NORMAL_INTENSITY} Version: ${Deno.version.deno}\n\n${details}`);
		await sendReport("unexpectederror", {
			name: error.name,
			message: error.message,
			stack: error.stack
		});
	}

	if (exit) Deno.exit(exitCode);
}