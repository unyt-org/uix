// deno-lint-ignore-file no-namespace
import { Datex } from "unyt_core";
import { arrayBufferToBase64, base64ToArrayBuffer } from "unyt_core/datex_all.ts";
import { HTMLUtils } from "../html/utils.ts";


export namespace Clipboard {

	// write
	export function putString(string: string){
		const data = [new ClipboardItem({ "text/plain": new Blob([string], { type: "text/plain" })})];
		return navigator.clipboard.write(data)
	}

	export function putHTML(html: string|HTMLElement){
		const data = [new ClipboardItem({"text/html": new Blob([html instanceof HTMLElement ? html.outerHTML : html], { type: "text/html" })})];
		return navigator.clipboard.write(data)
	}

	export function putDatexValue(value:any){
		return putDatex('application/datex-value', Datex.Compiler.encodeValue(value, undefined, true, true, true, false))
	}

	export function putDatexPointer(value:any){
		value = Datex.Pointer.pointerifyValue(value);
		return putDatex('application/datex-pointer', Datex.Compiler.encodeValue(value, undefined, true, false, true))
	}

	export async function putRawDatex(datex:string|ArrayBuffer, type:'application/datex'|'application/datex-value'|'application/datex-pointer' = 'application/datex'){
		return putDatex(type, datex instanceof ArrayBuffer ? datex : <ArrayBuffer>await Datex.Compiler.compile(datex));
	}

	async function putDatex(type:string, datex:ArrayBuffer) {
		try {
			const data = [new ClipboardItem({["web " + type]: new Blob([datex], { type: "web " + type })})];
			return await navigator.clipboard.write(data)
		} 
		// web prefix not supported
		catch (e) {
			const data = [new ClipboardItem({"text/plain": new Blob([type+"::"+arrayBufferToBase64(datex)], { type: "text/plain" })})];
			return await navigator.clipboard.write(data)
		}
	}

	// read
	export async function getItem(types?:string[]):Promise<any> {
		const item = (await getItems(types))[0];

		if (!item) return;

		// decide what to return (priority)
		if (item['text/html']) return item['text/html'];
		if (item['image/png']) return item['text/html'];
		if (item['application/datex-value']) return item['application/datex-value']; // contains DXB which returns a value
		if (item['application/datex-pointer']) return item['application/datex-pointer']; // contains pointer address as DXB
		if (item['application/datex']) return item['application/datex']; // contains a full DXB executable block
		if (item['text/datex']) return item['text/datex']
		if (item['text/plain']) return item['text/plain']
	}

	// custom type handlers
	export function registerTypeHandler(type:string, handler:(blob:Blob)=>Promise<any>|any) {
		if (typeof type == "string" && handler instanceof Function) {
			if (typeHandlers[type]) throw new Error("A type handler for type '"+type+"' already exists");
			typeHandlers[type] = handler;
		}
		else throw new Error("Invalid type handler registration");
	}


	const typeHandlers:{[type:string]:(blob:Blob, text:string)=>Promise<any>|any} = {
		'text/plain': function (blob:Blob, text:string) {
			return text;
		},
		'text/html': function (blob:Blob, text:string) {
			return HTMLUtils.createHTMLElement(`<div>${text}</div>`)
		},
		'image/png': function (blob:Blob) {
			const objectURL = URL.createObjectURL(blob);
			const image = new Image();
			image.src = objectURL;
			return image;
		},
		// special datex types
		'application/datex-value': async function (blob:Blob, text:string) {
			return Datex.Runtime.decodeValue(await blob.arrayBuffer())
		}
		// to be extended, currently not more types supported
	}

	async function getItems<T extends string[] = ["text/plain"]>(types:T = <T>Object.keys(typeHandlers)):Promise<Record<T[number], any>[]> {
		let items:ClipboardItems|undefined;
		
		try {
			if (navigator.clipboard?.read) {
				items = await navigator.clipboard?.read();
			}
			// fake text/plain item, if only readText supported
			else if (navigator.clipboard?.readText) {
				items = [{presentationStyle: "unspecified", getType:()=>{return <Promise<Blob>><unknown>{text:()=>navigator.clipboard?.readText()}}, types:['text/plain']}]
			}                
		} 
		catch (e) {
			return [];
		}

		const data:Record<T[number], any>[] = [];

		for (const clipboardItem of items??[]) {
			const item = <any>{};
			data.push(item);
			for (let type of clipboardItem.types) { 
				let blob = await clipboardItem.getType(type); 
				let text = await blob.text();
				// workaround for custom datex types
				if (type == "text/plain" && (text.startsWith("application/datex::") || text.startsWith("application/datex-value::") || text.startsWith("application/datex-pointer::"))) {
					const parts = text.split("::",2);
					type = parts[0];
					text = parts[1];
					console.log(type,text);
					blob = new Blob([base64ToArrayBuffer(text)]);
				}
				// workaround for web ... types
				else if (type.startsWith("web ")) {
					type = type.replace("web ", "")
				}
				if (types.includes(type)) item[type] = await typeHandlers[type]?.(blob, text);
			}
		}
		return data;
	}
}
