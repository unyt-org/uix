import { template } from "./src/html/template.ts";

const Example = template(({num}: {num: number}) => {
	console.log("ex22", num) // Ref<42>
	return <div>{num}</div>
})

export default <Example num={ 4 } />