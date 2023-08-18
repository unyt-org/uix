// deno-lint-ignore-file no-namespace
import { htmlElementAttributeValues } from "../html/attributes.ts"
import { UIX } from "uix";
import { UIXComponent } from "./UIXComponent.ts"
import { HTMLUtils } from "../html/utils.ts";
import { bindToOrigin } from "../utils/datex_over_http.ts";

export namespace ValueInput {
	export interface Options extends UIXComponent.Options {
		type?: htmlElementAttributeValues['input']['type'],
		placeholder?: string
	}
}

@Component<ValueInput.Options>({
	class: "value-input",
	type: "text"
})
export class ValueInput extends UIXComponent<ValueInput.Options, never> {

	@standalone @property count = 0;
	@standalone @layout input = <input onclick={()=>this.onClick()} type={this.options.type} placeholder={this.options.placeholder}/>
	
	@standalone onClick() {
		console.log("onClick", this.count++)
	}

}