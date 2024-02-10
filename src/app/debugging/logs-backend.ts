import { Datex } from "datex-core-legacy/mod.ts";
import { LOG_LEVEL } from "datex-core-legacy/utils/logger.ts";

@endpoint export class DebugLogs {
	@property static getLogs() {
		
		const timeout = 60 * 60 * 1000;

		const stream = $$(new Datex.Stream<string|ArrayBuffer>());
		Datex.Logger.logToStream(stream);

		// close stream after timeout
		setTimeout(() => {
			// \u0004 is the EOT character
			stream.write(new TextEncoder().encode("\n[Stream was closed after " + timeout + " minutes]\n\u0004").buffer);
			stream.close();
		}, timeout * 60 * 1000);

		return stream;
	}

	@property static enableMessageLogger() {
		enableMessageLogger()
	}

	@property static disableMessageLogger() {
		disableMessageLogger()
	}

	@property static enableVerboseLogs() {
		Datex.Logger.production_log_level = LOG_LEVEL.VERBOSE
		Datex.Logger.development_log_level = LOG_LEVEL.VERBOSE
	}

	@property static disableVerboseLogs() {
		Datex.Logger.production_log_level = LOG_LEVEL.DEFAULT
		Datex.Logger.development_log_level = LOG_LEVEL.DEFAULT
	}
}