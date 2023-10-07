import { scope, expose } from "unyt_core/datex.ts";
import { stage } from "../app/args.ts";

// uix.stage
const stageTransformFunction = await datex`
	function (options) (
		use currentStage from #public.uix;
		always options.(currentStage) default @@local
	);
`

@scope("uix") class UIXDatexModul {
    @expose static LANG = "en";
	@expose static stage = stageTransformFunction
	@expose static currentStage = stage
}