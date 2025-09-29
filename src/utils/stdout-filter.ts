const PATTERNS: Pattern[] = [
	{ includes: "is a no-op when running in node.js" },
	{ includes: "Warning The following packages contained npm lifecycle scripts" },
	{ includes: "Warning the configuration file" },
	{ includes: "Resolver diagnostics:" },
	{ statusStartsWith: "Download https://" }
];

type Pattern = {
	statusStartsWith?: string,
	matches?: string | RegExp,
	startsWith?: string,
	includes?: string
};

export async function* filterOutputStream(stream: ReadableStream<Uint8Array>, allowStatusFormatting = true) {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let statusModeActive = false;
	streaming: for await (const chunk of stream) {
		const rawText = decoder.decode(chunk);
		// deno-lint-ignore no-control-regex
		const text = rawText.replaceAll(/\u001b\[.*?m/g, "");
		// console.log("OUT", text)
		for (const pattern of PATTERNS) {
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
		} else yield chunk;
	}
}