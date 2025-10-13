const PATTERNS: Pattern[] = [
	{ includes: "is a no-op when running in node.js" },
	{ includes: "Warning The following packages contained npm lifecycle scripts" },
	{ includes: "Warning the configuration file" },
	{ includes: "Resolver diagnostics:" },
	{ includes: "Lifecycle scripts are only supported when using a `node_modules` directory" },
	{ statusStartsWith: "Download https://" }
];

const ABORT_CODE = "\u001b4";

type Pattern = {
	statusStartsWith?: string,
	matches?: string | RegExp,
	startsWith?: string,
	includes?: string
};

/**
 * Async generator that filters a {@link ReadableStream}, given a set of patterns.
 * Outputs unfiltered chunks once the {@link ABORT_CODE} is encountered.
 * @param stream The input stream
 * @param [allowStatusFormatting] Whether to allow grouping status-classified messages together
 * @param [patterns] A set of patterns to match, uses standard set of {@link PATTERNS} by defalt
 */
export async function* filterStream(
	stream: ReadableStream<Uint8Array>,
	allowStatusFormatting = true,
	patterns = PATTERNS
) {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let statusModeActive = false;
	let aborted = false;

	streaming: for await (const chunk of stream) {
		const rawText = decoder.decode(chunk);
		if (aborted || rawText.includes(ABORT_CODE)) {
			aborted = true;
			yield chunk;
			continue;
		}

		// deno-lint-ignore no-control-regex
		const text = rawText.replaceAll(/\u001b\[.*?m/g, "");
		// console.log("OUT", text)
		for (const pattern of patterns) {
			if ("matches" in pattern) {
				if (pattern.matches instanceof RegExp && pattern.matches.test(text)) continue streaming;
				else if (typeof pattern.matches === "string" && pattern.matches === text) continue streaming;
			}
			else if (typeof pattern.startsWith === "string" && text.startsWith(pattern.startsWith)) continue streaming;
			else if (typeof pattern.includes === "string" && text.includes(pattern.includes)) continue streaming;
			else if (typeof pattern.statusStartsWith === "string" && text.startsWith(pattern.statusStartsWith) && allowStatusFormatting) {
				statusModeActive = true;
				const lines = rawText.trimEnd().split("\n");
				let message = lines[0];
				if (message.length > 72) message = message.substring(0, 42) + "…" + message.substring(message.length - 30);
				if (lines.length > 1) yield encoder.encode("\r" + message + ` (+${lines.length - 1})… \u001b[K`);
				else yield encoder.encode("\r" + message + "… \u001b[K");
				continue streaming;
			}
		}

		if (statusModeActive) {
			statusModeActive = false;
			yield encoder.encode("\n" + rawText);
		} else {
			yield chunk;
		}
	}
}

/**
 * Filters a {@link ReadableStream} and calls a callback for each chunk.
 * Outputs unfiltered chunks once the {@link ABORT_CODE} is encountered.
 * Invokes {@link filterStream} to process the input.
 * 
 * 
 * @param stream The input stream
 * @param onChunk If specified, called whenver a chunk passed the filter successfully
 * @param [allowStatusFormatting] Whether to allow grouping status-classified messages together
 * @param [patterns] A set of patterns to match, uses standard set of {@link PATTERNS} by defalt
 */
export async function filterStreamToCallback(
	stream: ReadableStream<Uint8Array>,
	onChunk: (chunk: Uint8Array) => void,
	allowStatusFormatting = true,
	patterns = PATTERNS
) {
	for await (const chunk of filterStream(stream, allowStatusFormatting, patterns)) {
		onChunk(chunk);
	}
}

/**
 * When a subprocess' output is piped and filtered through {@link filterStream},
 * the subprocess can call this function to emit an {@link ABORT_CODE} on stdout and stderr.
 * This will cause the parent process to let all output pass through without filtering.
 */
export function abortFiltering() {
	Deno.stdout.writeSync(new TextEncoder().encode(ABORT_CODE));
	Deno.stderr.writeSync(new TextEncoder().encode(ABORT_CODE));
}