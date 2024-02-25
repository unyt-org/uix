import { scope, expose } from "datex-core-legacy";
import { client_type } from "datex-core-legacy/utils/constants.ts";

const stage = client_type == "deno" ? (await import("../app/args.ts#lazy")).stage : "TODO!";

// uix.stage
const stageTransformFunction = await datex`
	function (options) (
		use currentStage from #public.uix;
		always options.(currentStage) default @@local
	);
`

@scope("uix") class UIXDatexModule {
    @expose static LANG = "en";
	@expose static stage = stageTransformFunction
	@expose static currentStage = stage
}