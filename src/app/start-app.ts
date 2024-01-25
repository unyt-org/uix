import { Datex, f } from "datex-core-legacy";
import type { appOptions, normalizedAppOptions } from "./options.ts";
import { endpoint_config } from "datex-core-legacy/runtime/endpoint_config.ts";
import { http_over_datex, live, stage, watch, watch_backend } from "./args.ts";
import { BackendManager } from "./backend-manager.ts";
import { Server } from "../server/server.ts";
import { FrontendManager } from "./frontend-manager.ts";
import { Path } from "../utils/path.ts";
import { convertToWebPath } from "./convert-to-web-path.ts";
import { getDirType } from "./utils.ts";

const logger = new Datex.Logger("UIX App");

export async function startApp(app: {domains:string[], options?:normalizedAppOptions, base_url?: URL}, options:appOptions = {}, original_base_url?:string|URL) {

	const frontends = new Map<string, FrontendManager>()

	// prevent circular dependency problems
	const {normalizeAppOptions} = await import("./options.ts")

	const [nOptions, baseURL] = await normalizeAppOptions(options, original_base_url);

	// set app base_url + options directly
	app.options = nOptions;
	app.base_url = baseURL;


	// enable experimental features
	if (app.options?.experimentalFeatures.includes("protect-pointers")) Datex.Runtime.OPTIONS.PROTECT_POINTERS = true;


	// for unyt log
	Datex.Unyt.setAppInfo({name:nOptions.name, version:nOptions.version, stage:stage, host:Deno.env.has("UIX_HOST_ENDPOINT") && Deno.env.get("UIX_HOST_ENDPOINT")!.startsWith("@") ? f(Deno.env.get("UIX_HOST_ENDPOINT") as any) : undefined, dynamicData: app})

	// set .dx path to backend
	if (nOptions.backend.length) {
		await endpoint_config.load(new URL("./.dx", nOptions.backend[0]))
	}

	// connect to supranet
	if (endpoint_config.connect !== false) await Datex.Supranet.connect();
	else await Datex.Supranet.init(undefined);

	// TODO: map multiple backends to multiple frontends?
	let backend_with_default_export:BackendManager|undefined;
	const backendManagers = [];
	// load backend
	for (const backend of nOptions.backend) {
		const backend_manager = new BackendManager!(nOptions, backend, baseURL, (live||watch_backend) ? true : (watch ? "info" : false));
		await backend_manager.run()
		backendManagers.push(backend_manager);
		if (backend_manager.content_provider!=undefined) {
			if (backend_with_default_export!=undefined) logger.warn("multiple backend entrypoint export a default content");
			backend_with_default_export = backend_manager; 
		}
	}

	// also override endpoint default
	if (backend_with_default_export) {
		Datex.Runtime.endpoint_entrypoint = backend_with_default_export.entrypointProxy;
		backend_with_default_export.content_provider[Datex.DX_SOURCE] = Datex.Runtime.endpoint.toString(); // use @@local::#entrypoint as dx source
	}

	let server:Server|undefined
	// load frontend
	for (const frontend of nOptions.frontend) {
		const frontend_manager = new FrontendManager(nOptions, frontend, baseURL, backend_with_default_export??backendManagers[0], watch, live)
		await frontend_manager.run();
		server = frontend_manager.server;
		frontends.set(frontend.toString(), frontend_manager);
	}
	// no frontend, but has backend with default export -> create empty frontend
	if (!nOptions.frontend.length && backend_with_default_export) {
		// TODO: remove tmp dir on exit
		const dir = new Path(Deno.makeTempDirSync()).asDir();
		const frontend_manager = new FrontendManager(nOptions, dir, baseURL, backend_with_default_export, watch, live)
		await frontend_manager.run();
		server = frontend_manager.server;
		frontends.set(dir.toString(), frontend_manager);
	}


	// expose DATEX ws server node, shown in /.dx
	// TODO: option to disable direct backend ws connection
	if (server && endpoint_config.ws_relay !== false) {
		const DatexServer = (await import("../server/datex_server.ts")).DatexServer
		DatexServer.addInterfaces(["websocket", "webpush"], server);
		// also add custom .dx file
		const nodes = new Map<Datex.Endpoint, {channels:Record<string,string>,keys:[ArrayBuffer, ArrayBuffer]}>();
		nodes.set(Datex.Runtime.endpoint,  {
			channels: {
				'websocket': '##location##'
			},
			keys: Datex.Crypto.getOwnPublicKeysExported()
		})

		// copy nodes from backend dx to frontend dx
		if (endpoint_config.nodes) {
			for (const [endpoint, config] of endpoint_config.nodes) {
				nodes.set(endpoint, config);
			}
		}
		const dxContent = {
			nodes:nodes
		};
		// copy blockchain_relay from backend dx to frontend dx
		if (endpoint_config.blockchain_relay) dxContent.blockchain_relay = endpoint_config.blockchain_relay;

		const dxFile = Datex.Runtime
			.valueToDatexStringExperimental(new Datex.Tuple(dxContent), true, false, false, false, false)
			.replace('"##location##"', '#location');

		server.path("/.dx", async (req) => {
			// direct web socket connection not suppported for unyt.app, don't send .dx
			if (!req.request.headers.get("x-forwarded-host")?.endsWith(".unyt.app")) {
				await req.respondWith(server!.getContentResponse(
					"text/datex",
					dxFile
				))
				return true;
			}			
			return false;
		})
	}

	// js type def module mapping
	Datex.Type.setJSTypeDefModuleMapper((url, type) => {
		const webPath = convertToWebPath(url);

		try {
			url = new URL(url);
		}
		catch {
			// ignore
		}

		if (url instanceof URL && app.options) {
			const dirType = getDirType(app.options, new Path(url));
			if (dirType == "backend") {
				return `fatal:Tried to load the @sync class "${type.interface_config?.class?.name ?? type.name}" from the backend module ${webPath.replace("/@uix/src/","")} in the frontend. This is currently not supported - please put the class definition in a common module.`
			}
		}
		// ignore cdn urls, assumes that the modules are already imported on all clients
		// TODO: improve, what if type modules are not all loaded per default?
		if (webPath.startsWith("https://dev.cdn.unyt.org/") || webPath.startsWith("https://cdn.unyt.org/")) return;
		else if (webPath.startsWith("https://") || webPath.startsWith("http://")) return webPath;
		else return `route:${webPath}`
	})

	// enable HTTP-over-DATEX
	if (server && http_over_datex) {
		const {HTTP} = await import("./http-over-datex.ts")
		HTTP.setServer(server);
	}
	
	return {
		defaultServer: server,
		frontends,
		nOptions, 
		baseURL
	}
}