import { client_type } from "datex-core-legacy/utils/constants.ts";
import { datex } from "datex-core-legacy/mod.ts";

const stage = client_type == "deno" ? (await import("../app/args.ts#lazy")).stage : "TODO!";

// uix.stage
const stageTransformFunction = await datex`
	function (options) (
		use currentStage from #public.uix;
		always options.(currentStage) default @@local
	);
`

@endpoint class uix {
    @property static LANG = "en";
	@property static stage = stageTransformFunction
	@property static currentStage = stage
}