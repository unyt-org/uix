console.log("http-over-datex");

@endpoint export class HTTP {
	@property static request(data:string) {
		console.log("REQUEST", data)
	}
}