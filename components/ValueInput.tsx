// deno-lint-ignore-file no-namespace
import {BaseComponent} from "./BaseComponent.ts"

export namespace ValueInput {
	export interface Options extends BaseComponent.Options {
		type?: string,
		placeholder?: string
	}
}

@Component<ValueInput.Options>({
	type: "text"
})
export class ValueInput extends BaseComponent<ValueInput.Options, HTMLButtonElement> {
	@child input = <input type={this.options.type} placeholder={this.options.placeholder}/>

	protected override onConstruct() {
		this.classList.add("value-input")
	}
}

function x () {
	const x = <ValueInput/>
}