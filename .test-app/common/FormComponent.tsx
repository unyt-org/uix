import { bindToDisplayContext } from "uix/utils/datex-over-http.ts";
import { Component } from "uix/components/Component.ts";
import { template } from "uix/html/template.ts";


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
		<button onclick:frontend={logDisplay}>Log (Display)</button>
		<button onclick={log}>Log</button>
		<button onclick:frontend={() => alert()}>Alert (Display)</button>
		<button onclick:frontend={() => use(alert) && alert("alert")}>Alert</button>
		<button onclick:frontend={() => use(this) && this.increaseCounter()}>Increase Counter</button>
	</div>
})
export class FormComponent extends Component {

	protected override onCreate(): void|Promise<void> {
	  this.options.title = "test"
	}

	// @content val = <div>CONTENT <b>{count}</b></div>

	@frontend x = 10;
	y = 10;

	increaseCounter() {
		console.log(this.x)
		use (count);
		console.log("increase counter", count);
		count.val ++;
	}
}