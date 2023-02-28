import { Datex } from "unyt_core";
import { UIX } from "../uix.ts";
import { DatexValueTreeView } from "../uix_std/datex/value_tree_view.ts";
import { convertANSIToHTML } from "./ansi_to_html.ts";
import { logger } from "./global_values.ts";

const POINTER_REGEX = /\$((?:[A-Fa-f0-9]{2}|[xX][A-Fa-f0-9]){1,26})(\s*[:+-/*&|^]?=(?![=>/]))? *(\()?/gm;

const persistant_pointer_tooltips = new Set<HTMLElement>();
const pointer_tooltips = new Map<HTMLElement, Function>();
const visible_pointers = new Map<HTMLElement, any>();

async function showPointerTooltip(target:HTMLElement){
	if (pointer_tooltips.has(target)) return; // already expanded

	const pointer_string = target.innerText.trim();
	try {
		visible_pointers.set(target, (await Datex.Pointer.load(pointer_string.replace("$",""), undefined, undefined, undefined, true)).val); // prevent garbage collection
	}
	catch (e){
		logger.warn("could not load pointer " + pointer_string);
		return;
	}
	await new Promise(resolve=>setTimeout(resolve,10));

	// create new container for pointer tooltip
	const tree_view = new DatexValueTreeView({padding_left: 10, padding_top:10, padding:10, root_resource_path:"dxptr://"+Datex.Pointer.normalizePointerId(pointer_string)+"/", display_root:true, header:false, title:pointer_string}, {dynamic_size:true})
	const container = document.createElement("div");
	// container.style.width = target.offsetWidth + 'px'; //"448px";
	container.style.height = "auto";
	tree_view.anchor(container);


	// show 'tooltip'
	const bounds = target.getBoundingClientRect();
	const height = bounds.height + container.getBoundingClientRect().height/2 + 15;
	pointer_tooltips.set(target, UIX.Handlers.showTooltip(container, bounds.left, bounds.top+height, 'right', false).hide)
}

function showPointerTooltipPersistent(target:HTMLElement){
	// now hide if persitant tooltip already exists (toggle click)
	if (persistant_pointer_tooltips.has(target)) {
		persistant_pointer_tooltips.delete(target);
		hidePointerTooltip(target)
	}
	else {
		showPointerTooltip(target)
		persistant_pointer_tooltips.add(target)
	}
}

function hidePointerTooltip(target:HTMLElement){
	if (persistant_pointer_tooltips.has(target)) return; // is persistant, don't hide
	if (visible_pointers.has(target)) visible_pointers.delete(target); // make pointer garbage-collectable again
	pointer_tooltips.get(target)?.();
	pointer_tooltips.delete(target);
}


// adds hover links for pointers
// TODO: hover over URLS, endpoints
export function convertANSIWithDATEXToHTML(content: string) {
	let html = convertANSIToHTML(content)

	html = html.replace(POINTER_REGEX, '<span class="dx-pointer hoverable">$&</span>')
	const el = UIX.Utils.createHTMLElement(html);

	el.querySelectorAll('.dx-pointer').forEach(ptr=>{
		ptr.addEventListener("mouseenter", e => showPointerTooltip(ptr));
		ptr.addEventListener("mouseout", e => hidePointerTooltip(ptr));
		ptr.addEventListener("click", e => showPointerTooltipPersistent(ptr));
	})

	return el;
}