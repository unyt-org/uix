import { Datex } from "unyt_core/datex.ts";
import { always } from "unyt_core/datex_short.ts";

console.log("lazy loaded module")

@sync class Test {

	@property a = 10;
	@property b = 20;

	@always get sum() {
		return this.a + this.b
	}

}

const test = new Test() as Datex.JSValueWith$<Test>;
Datex.Ref.observe(test.$.sum, (x)=>console.log("sum changed: " + x))
console.log(test)
console.log(test.a,test.b,test.sum)


test.a = 20;
console.log(test.a,test.b,test.sum)
test.a = -100

export default "lazy ..."