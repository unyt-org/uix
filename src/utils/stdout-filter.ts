const PATTERNS: Pattern[] = [
	{ matches: "SourceMapConsumer.initialize is a no-op when running in node.js\n" },
	{ startsWith: "Warning The following packages contained npm lifecycle scripts" },
	{ startsWith: "Resolver diagnostics:" },
];

type Pattern = {
	matches?: string | RegExp,
	startsWith?: string,
};

export async function* filterOutputStream(stream: ReadableStream<Uint8Array>) {
	const decoder = new TextDecoder();
	streaming: for await (const chunk of stream) {
		// deno-lint-ignore no-control-regex
		const text = decoder.decode(chunk).replace(/\u001b\[.*?m/g, "");
		for (const pattern of PATTERNS) {
			if ("matches" in pattern) {
				if (pattern.matches instanceof RegExp && pattern.matches.test(text)) continue streaming;
				else if (typeof pattern.matches === "string" && pattern.matches === text) continue streaming;
			}
			else if (typeof pattern.startsWith === "string" && text.startsWith(pattern.startsWith)) continue streaming;
		}

		yield chunk;
	}
}