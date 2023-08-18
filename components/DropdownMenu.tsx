// deno-lint-ignore-file no-namespace
import { htmlElementAttributeValues } from "../html/attributes.ts"
import { UIX } from "uix";
import { UIXComponent } from "./UIXComponent.ts"

export namespace DropdownMenu {
	export interface Options extends UIXComponent.Options {

	}
}

@Component<DropdownMenu.Options>({
	
})
export class DropdownMenu extends UIXComponent<DropdownMenu.Options, never> {

}