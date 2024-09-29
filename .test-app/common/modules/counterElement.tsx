const count = $(0);

export default await lazyEternal ?? $(
	<div>

		<button onclick={() => {
			use (count)

			console.log("clicked!");
			count.val++
		}}>
			I was clicked {count} times
		</button>

		<button onclick:frontend={() => alert("Hey there")}>
			Show Alert
		</button>

	</div>
)