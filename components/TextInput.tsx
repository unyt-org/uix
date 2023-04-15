// deno-lint-ignore-file no-namespace
import {BaseComponent} from "./BaseComponent.ts"


export namespace TextInput {
	export interface Options extends BaseComponent.Options {
		placeholder: string
	}
}

@Component<TextInput.Options>({
	placeholder: "..."
})
export class TextInput extends BaseComponent<TextInput.Options, never> {
	@layout x = "textinput"
	@child c1 = <h3>child 1</h3>

	override onConstruct() {
		console.log("oncstruct",this.options)
	}
	override onInit() {
		console.log("oninit")
	}
	override onCreate() {
		console.log("oncrate")
	}
	override onDisplay() {
		console.log("ondisplay")
	}
}