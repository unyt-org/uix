import { transferable } from "datex-core-legacy/types/js-function.ts";

const count = $$(0);

const helloWorld = transferable(() => {
	alert("HELLOW ROLD");
	console.log("HELLO WORLD")
})

export default
	<div>

		<button onclick={() => {
			use (count);
			console.log("clicked!");
			count.val++
		}}>
			I was clicked {count} times
		</button>

		<button onclick:display={() => use (helloWorld) && helloWorld()}>
			Show Alert
		</button>

	</div>
