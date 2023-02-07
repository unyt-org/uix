import { Datex } from "unyt_core";
import { NOT_EXISTING, ValueError } from "unyt_core/datex_all.ts";
import { Components} from "../components/main.ts";

// proxy for Storage, binds existing UIX DOM Elements to pointer values

class DOMPointerSource implements Datex.PointerSource {

	async getPointer(pointer_id: string, pointerify?: boolean) {
		const element = document.getElementById(pointer_id); // get skeleton element from DOM
	
		if (element) {
			if (!element.hasAttribute("skeleton")) throw new ValueError("Cannot bind a value to a non-skeleton UIX component");
			//console.log("get dom pointer", pointer_id, element);
			await Datex.Storage.getPointer(pointer_id, pointerify, element); // bind pointer to element
			await (<Components.Base>element).unSkeletonize() // no longer a skeleton element
			return element;
		} 
		else return NOT_EXISTING;
	}


    syncPointer(pointer:Datex.Pointer) {
        return Datex.Storage.syncPointer(pointer)
    }

	
}

export const domPointerSource = new DOMPointerSource();
Datex.Pointer.registerPointerSource(domPointerSource, 1)