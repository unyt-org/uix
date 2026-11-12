import { convertToWebPath } from "../app/convert-to-web-path.ts";

export const OPEN_GRAPH = Symbol("OPEN_GRAPH");

/**
 * SECURITY: escapes text for HTML text content and attribute values
 */
export function escapeHtmlText(value: unknown) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export interface OpenGraphData {
	title: string,
	description?: string
}

/**
 * Can be implemented to generate a custom preview image
 */
export interface OpenGraphPreviewImageGenerator {
	getImageURL(data: OpenGraphData): Promise<string|URL>|string|URL
}

/**
 * Constructed with OpenGraphData and an preview image generator
 * Has a getMetaTags() function that returns a string of HTML meta tags (title, description, image)
 */
export class OpenGraphInformation {

	constructor(public data: OpenGraphData, private image_generator?:OpenGraphPreviewImageGenerator) {}

	#meta_tags?:string

	async getMetaTags() {
		if (!this.#meta_tags) {
			const image_url = this.image_generator ? escapeHtmlText(convertToWebPath(await this.image_generator.getImageURL(this.data))) : null;
			// SECURITY: title and description can contain user data
			const title = escapeHtmlText(this.data.title);
			const description = this.data.description ? escapeHtmlText(this.data.description) : undefined;
			this.#meta_tags = `
<title>${title}</title>
${description?`<meta name="description" content="${description}">`:''}
<meta property="og:title" content="${title}">
${description?`<meta property="og:description" content="${description}">`:''}
${image_url?`<meta property="og:image" content="${image_url}">`:''}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
${description?`<meta name="twitter:description" content="${description}">`:''}
${image_url?`<meta name="twitter:image" content="${image_url}">`:''}`
		}
		
		return this.#meta_tags;
	}
}