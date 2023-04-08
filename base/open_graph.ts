import { App } from "../app/app.ts";

export const OPEN_GRAPH = Symbol("OPEN_GRAPH");

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


export class OpenGraphInformation {

	constructor(public data: OpenGraphData, private image_generator?:OpenGraphPreviewImageGenerator) {}

	#meta_tags?:string

	async getMetaTags() {
		if (!this.#meta_tags) {
			const image_url = this.image_generator ? App.filePathToWebPath(await this.image_generator.getImageURL(this.data)) : null;
			this.#meta_tags = `
<title>${this.data.title}</title>
${this.data.description?`<meta name="description" content="${this.data.description}">`:''}
<meta property="og:title" content="${this.data.title}">
${this.data.description?`<meta property="og:description" content="${this.data.description}">`:''}
${image_url?`<meta property="og:image" content="${image_url}">`:''}

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${this.data.title}">
${this.data.description?`<meta name="twitter:description" content="${this.data.description}">`:''}
${image_url?`<meta name="twitter:image" content="${image_url}">`:''}`
		}
		
		return this.#meta_tags;
	}
}