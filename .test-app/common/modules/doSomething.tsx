import { bindToDisplayContext } from "uix/app/datex-over-http.ts";

const doSomething = function(){
	console.log("doing something...") // backend or frontend
}
const doSomething2 = bindToDisplayContext(doSomething)

export default <>
  <button onclick={doSomething}>Clickme #0</button>
  <button onclick:frontend={doSomething}>Clickme #1</button>
  <button onclick={() => doSomething()}>Clickme #2</button>
  <button onclick:frontend={() => use (doSomething) && doSomething()}>Clickme #3</button>

  <button onclick={doSomething2}>Clickme #4</button>
  <button onclick:frontend={doSomething2}>Clickme #5</button>
  <button onclick={() => doSomething2()}>Clickme #6</button>
  <button onclick:frontend={() => use (doSomething2) && doSomething2()}>Clickme #7</button>

  <button onclick={() => alert("hi")}>Clickme #8</button>
  <button onclick:frontend={() => alert("hi")}>Clickme #9</button>
  <button onclick={() => use (alert) && alert("hi")}>Clickme #10</button>
  <button onclick:frontend={() => use (alert) && alert("hi")}>Clickme #11</button>
</>

/**
 * 
 * #0: backend
 * #1: frontend
 * #2: backend
 * #3: backend
 * 
 * #4: frontend
 * #5: frontend
 * #6: error (not allowed)
 * #7: frontend
 * 
 * #8: backend
 * #9: frontend
 * #10: backend
 * #11: backend
 */