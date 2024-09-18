import { Datex } from "datex-core-legacy";

console.log("lazy loaded module")

@sync class Test {

	@property a = 10;
	@property b = 20;

	@property get sum() {
		return this.a + this.b
	}

}

const test = new Test() as Datex.ObjectRef<Test>;
Datex.ReactiveValue.observe(test.$.sum, (x)=>console.log("sum changed: " + x))
console.log(test)
console.log(test.a,test.b,test.sum)


test.a = 20;
console.log(test.a,test.b,test.sum)
test.a = -100

export default "lazy ..."