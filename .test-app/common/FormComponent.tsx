import { bindToDisplayContext } from "uix/utils/datex-over-http.ts";
import { UIXComponent } from "uix/components/UIXComponent.ts";
import { template } from "uix/html/anonymous-components.ts";


const count = $$(0);

function log() {
	console.log("log")
}

const logDisplay = bindToDisplayContext(function () {
	console.log("log")
})

@template(function (this: FormComponent, {name}) {
	return <div>
		<h1>Hello {name}</h1>
		Hello Component
		<p>
		Counter: {count}
		</p>
		<button onclick:display={logDisplay}>Log (Display)</button>
		<button onclick={log}>Log</button>
		<button onclick:display={() => alert()}>Alert (Display)</button>
		<button onclick:display={() => use(alert) && alert("alert")}>Alert</button>
		<button onclick:display={() => use(this) && this.increaseCounter()}>Increase Counter</button>
	</div>
})
export class FormComponent extends UIXComponent {

	protected override onCreate(): void|Promise<void> {
	  this.options.title = "test"
	}

	// @content val = <div>CONTENT <b>{count}</b></div>

	@display x = 10;
	y = 10;

	increaseCounter() {
		console.log(this.x)
		use (count);
		console.log("increase counter", count);
		count.val ++;
	}
}