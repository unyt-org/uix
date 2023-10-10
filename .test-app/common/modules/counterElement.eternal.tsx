
const count = $$(0);

export default
	<div>

		<button onclick={() => {
			use (count);
			console.log("clicked!");
			count.val++
		}}>
			I was clicked {count} times
		</button>

		<button onclick:display={() => alert("Hey there")}>
			Show Alert
		</button>

	</div>
