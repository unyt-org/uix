import { Datex, f } from "datex-core-legacy";
import type { appOptions, normalizedAppOptions } from "./options.ts";
import { endpoint_config } from "datex-core-legacy/runtime/endpoint_config.ts";
import { http_over_datex, live, stage, watch, watch_backend } from "./args.ts";
import { BackendManager } from "./backend-manager.ts";
import { Server } from "../server/server.ts";
import { FrontendManager } from "./frontend-manager.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { convertToWebPath } from "./convert-to-web-path.ts";
import { getDirType } from "./utils.ts";
import { WebSocketServerInterface } from "datex-core-legacy/network/communication-interfaces/websocket-server-interface.ts"
import { HTTPServerInterface } from "datex-core-legacy/network/communication-interfaces/http-server-interface.ts"
import { communicationHub } from "datex-core-legacy/network/communication-hub.ts";
import { resolveDependencies } from "../html/dependency-resolver.ts";
import { Ref } from "datex-core-legacy/runtime/pointers.ts";

const logger = new Datex.Logger("UIX App");

/**
 * Start the UIX app on the backend
 */
export async function startApp(app: {domains:string[], hostDomains: string[], options?:normalizedAppOptions, base_url?: URL}, options:appOptions = {}, original_base_url?:string|URL) {

	// // enable network interface (TODO: remove, is now in datex-core-legacy)
	// await import("../server/network-interface.ts");

	const frontends = new Map<string, FrontendManager>()

	// prevent circular dependency problems
	const {normalizeAppOptions} = await import("./options.ts")

	const [nOptions, baseURL] = await normalizeAppOptions(options, original_base_url);

	// set app base_url + options directly
	app.options = nOptions;
	app.base_url = baseURL;


	// enable experimental features
	if (app.options?.experimental_features.includes("indirect-references")) Datex.Runtime.OPTIONS.INDIRECT_REFERENCES = true;

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
		const content_provider = backend_with_default_export.content_provider;
		if ((content_provider && typeof content_provider == "object" && !(content_provider instanceof Ref)) || typeof content_provider == "function")
			(content_provider as any)[Datex.DX_SOURCE] = Datex.Runtime.endpoint.toString(); // use @@local::#entrypoint as dx source
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
	if (server && endpoint_config.ws_relay !== false) {

		// add WebSocket and HTTP server interfaces
		await communicationHub.addInterface(new WebSocketServerInterface(server));
		await communicationHub.addInterface(new HTTPServerInterface(server));

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
			nodes: nodes
		};
		// copy blockchain_relay from backend dx to frontend dx
		if (endpoint_config.blockchain_relay) dxContent.blockchain_relay = endpoint_config.blockchain_relay;

		const dxFile = Datex.Runtime
			.valueToDatexStringExperimental(new Datex.Tuple(dxContent), true, false, false, false, false)
			.replace('"##location##"', '#location');

		server.path("/.dx", async (req) => {
			const host = req.request.headers.get("x-forwarded-host");
			const isHttpOverDatex = req.request.headers.get("x-http-over-datex") == "yes" 	
			const isDirect = host && app.hostDomains.includes(host);

			// contradictory - is http over datex, but should be direct http
			if (isHttpOverDatex && isDirect) {
				logger.warn("Received an HTTP-over-DATEX request, but should use a direct HTTP connection via " + host);
			}

			// direct web socket connection not suppported for unyt.app with HTTP-over-DATEX, don't send .dx
			if (
				host?.endsWith(".unyt.app") // is a unyt.app subdomain
				&& (
					isHttpOverDatex || // is HTTP-over-DATEX
					!isDirect // can be assumed use HTTP-over-DATEX
				)  
			) {
				return false
			}

			else {
				await req.respondWith(server!.getContentResponse(
					"text/datex",
					dxFile
				))
				return true;
			}
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
		// ignore local clones of the core libs
		else if (webPath.toString().includes("/datex-core-js-legacy/") || webPath.toString().includes("/uix/")) return;
		else if (webPath.startsWith("https://") || webPath.startsWith("http://")) return webPath;
		else return `route:${webPath}`
	})

	// enable HTTP-over-DATEX
	if (server && http_over_datex) {
		const {HTTP} = await import("./http-over-datex.ts")
		HTTP.setServer(server);
	}

	// preload dependencies
	resolveDependencies(import.meta.resolve("datex-core-legacy"), app.options!)
	
	return {
		defaultServer: server,
		frontends,
		nOptions, 
		baseURL
	}
}