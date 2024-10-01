import satori, { init as initSatori } from "https://esm.sh/satori@0.10.4/wasm";
// @ts-ignore $
import { initStreaming } from "https://esm.sh/yoga-wasm-web@0.3.0";
import { render as convertSVGToPNG } from "https://deno.land/x/resvg_wasm@0.2.0/mod.ts";
import { html } from "https://cdn.jsdelivr.net/npm/satori-html@0.3.2/+esm";
import { type Yoga } from "https://esm.sh/v135/yoga-wasm-web@0.3.3/dist/index.js";
import { provideContent } from "../html/entrypoint-providers.tsx";
import { getOuterHTML } from "../html/render.ts";

const DEFAULT_SIZE = 200;
const DEFAULT_CONTENT_TYPE = "svg";
const MIME_TYPE_LOOKUP = {
	"svg": "image/svg+xml",
	"png": "image/png",
	"gif": "image/gif",
	"jpeg": "image/jpeg",
	"webp": "image/webp"
} as const;

const loadFont = (url: string) => fetch(url).then((a) => a.arrayBuffer());
const fallbackFont = await loadFont("https://cdn.jsdelivr.net/npm/@vercel/og@0.1.0/vendor/noto-sans-v27-latin-regular.ttf");
const yoga_wasm = fetch("https://cdn.jsdelivr.net/npm/@vercel/og@0.1.0/vendor/yoga.wasm");
const initializedYoga = initStreaming(yoga_wasm).then((yoga: Yoga) => initSatori(yoga));
await initializedYoga;

export type Font = {
	data: Uint8Array | ArrayBuffer;
	name: string;
	weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
	style?: 'normal' | 'italic';
	lang?: string;
}

async function renderSVGString(element: Element, options: ResolvedImageOptions) {
	const satoriSyntax = html(getOuterHTML(element).at(1));
	return await satori(satoriSyntax as React.ReactNode, options);
}

async function renderPNG(element: Element, options: ResolvedImageOptions) {
	const svg = await renderSVGString(element, options);
	return await convertSVGToPNG(svg);
}

type InternalImageOptions = ({
	width: number;
	height: number;
} | {
	width: number;
} | {
	height: number;
}) &
{
	width?: number,
	height?: number,
	fonts?: Font[]
};

export type ImageOptions = InternalImageOptions & 
{
	contentType?: "png" | "svg" | "jpeg" | "webp" | "gif",
	fonts?: Font | Font[]
};
type ResolvedImageOptions = InternalImageOptions & { fonts: Font[] };

export async function renderImage(element: Element, { 
	contentType = DEFAULT_CONTENT_TYPE,
	width,
	height,
	fonts = [
		{
			name: "sans serif",
			data: fallbackFont,
			weight: 700,
			style: "normal"
		}
	]
}: ImageOptions = { contentType: DEFAULT_CONTENT_TYPE, width: DEFAULT_SIZE }) {
	const options: ResolvedImageOptions = {
		width: width!,
		height,
		fonts: Array.isArray(fonts) ? fonts : [fonts]
	}
	switch (contentType) {
		case "png":
			return renderPNG(element, options);
		case "svg": {
			const svgString = await renderSVGString(element, options);
			return new TextEncoder().encode(svgString);
		}
		default:
			throw new Error(`Unhandled content type '${contentType}'`);
	}
}

/**
 * 
 * @param element JSX Element that should be rendered using Satori
 * @param options Rendering options for Satori and status code for HTTP server
 * @returns Serves Image with specified mime type
 */
export async function provideImage(element: Element, options?: ImageOptions & { status?: number }) {
	const contentType = options?.contentType ?? DEFAULT_CONTENT_TYPE;
	const bufferedImage = await renderImage(element, options);
	return provideContent(
		bufferedImage,
		MIME_TYPE_LOOKUP[contentType],
		options?.status ?? 200
	);
}