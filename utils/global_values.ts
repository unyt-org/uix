import { Datex } from "unyt_core";
import type { Components } from "../components/main.ts"
import { IS_HEADLESS } from "./constants.ts";
import type { Types } from "./global_types.ts";

export const logger = new Datex.Logger("UIX");

// main container
export const root_container = <HTMLElement> document.querySelector("#main") ?? document.body.shadowRoot?.querySelector("#main") ?? document.createElement("slot") 
root_container.id = "main"
// init body shadow root
if (!IS_HEADLESS && !document.body.shadowRoot) {
	document.body.attachShadow({mode:'open'});
	document.body.shadowRoot!.append(root_container);
}

// notification container
export const notification_container = document.createElement("aside"); 
notification_container.classList.add("notification-container");
if (!IS_HEADLESS) document.body.shadowRoot!.append(notification_container)


export const global_states = {
	shift_pressed: false,
	meta_pressed: false,
	mouse_x: 0,
	mouse_y: 0
}


export const unsaved_components = new Set<Components.Base>();
export const abstract_component_classes = new Set<Types.ComponentSubClass>(); // set including all classes marked as @UIX.Abstract
export const component_classes = new Map<Datex.Type, Types.ComponentSubClass>();
export const component_groups = new Map<string, Set<Types.ComponentSubClass>>();

