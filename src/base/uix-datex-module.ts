import { client_type } from "datex-core-legacy/utils/constants.ts";
import { datex } from "datex-core-legacy/mod.ts";

const stage = client_type == "deno" ? (await import("../app/args.ts#lazy")).stage : "TODO!";

// Can't use @endpoint class here, because endpoint is only initialized after #public.uix is required in .dx config
export async function addUIXNamespace() {

	await datex`
		#public.uix = {
			LANG: "en",
			currentStage: ${stage},
			stage: function (options) (
				use currentStage from #public.uix;
				always options.(currentStage) default @@local
			)
		};
	`
}
