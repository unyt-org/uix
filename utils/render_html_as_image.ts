import { Datex } from "unyt_core";
import { UIX_CACHE_PATH } from "./constants.ts";
import { generateHTMLPage, getOuterHTML } from "../html/render.ts";
import { createSnapshot } from "../html/rendering.ts";
import { RenderMethod } from "../html/render-methods.ts";
import { HTMLProvider } from "../html/html_provider.ts";
import { Path } from "../utils/path.ts";
import { TypescriptImportResolver } from "../server/ts_import_resolver.ts";
import { ImportMap } from "../utils/importmap.ts";
import type {Browser} from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { app } from "../app/app.ts";
import { convertToWebPath } from "../app/utils.ts";

const logger = new Datex.Logger("HTML Image Renderer");

// TODO: where to get importmap?
const import_map = new ImportMap({
	"imports": {
		"unyt/": "https://dev.cdn.unyt.org/",

		"unyt_core": "unyt_core",
		"uix": "https://dev.cdn.unyt.org/uix/uix.ts",

		"unyt_core/": "https://dev.cdn.unyt.org/unyt_core/",
		"uix/": "https://dev.cdn.unyt.org/uix/",
		"uix_std/": "https://dev.cdn.unyt.org/uix/uix_std/",
		"unyt_tests/": "https://dev.cdn.unyt.org/unyt_tests/",
		"unyt_web/": "https://dev.cdn.unyt.org/unyt_web/",
		"unyt_node/": "https://dev.cdn.unyt.org/unyt_node/",
		"unyt_cli/": "https://dev.cdn.unyt.org/unyt_cli/",

		"supranet/": 	"https://portal.unyt.org/ts_module_resolver/",

		"uix/jsx-runtime": "https://dev.cdn.unyt.org/uix/jsx-runtime/jsx.ts",

		"backend/": "./backend/",
		"common/": "./common/",
		"frontend/": "./frontend/"
	}
})

const basePath = new Path(await Deno.makeTempDir()).asDir()

const renderHTMLProvider = new HTMLProvider(basePath, {import_map}, new TypescriptImportResolver(basePath, {
	import_map
}), false, basePath);

export type renderOptions = {
	width?: number,
	height?: number,
	scale?:number,
	identifier?: string,
	useCache?: boolean,
	_debug?: boolean
}

let browser: Browser|undefined
let browserCloseTimeout: number|undefined

export async function renderHTMLAsImage(element: HTMLElement|DocumentFragment, options?:renderOptions) {

	clearTimeout(browserCloseTimeout);

	const { default:puppeteer } = await import("https://deno.land/x/puppeteer@16.2.0/mod.ts");

	const name = (options?.identifier?.replaceAll(/[ \-&/+*#!.,;"']+/g, "_") ?? "generated_"+new Date().toISOString()) + ".png";
	const path = UIX_CACHE_PATH.getChildPath(name);

	// preview image already cached
	if (options?.useCache && path.fs_exists) return convertToWebPath(path, true);

	const headless = !options?._debug;
	const args = [
		'--no-sandbox',
		'--disable-dev-shm-usage'
	]
	// use /usr/lib/chromium/chrome if installed in docker, otherwise install chromium with deno installer

	const executablePath = Path.File("/usr/lib/chromium/chrome").fs_exists ? "/usr/lib/chromium/chrome" : undefined;

	if (!browser) {
		try {
			browser = await puppeteer.launch({headless, executablePath, args});
		}
		catch {
			await installPuppeteer();
			browser = await puppeteer.launch({headless, executablePath, args});
		}
	}

	const page = await browser.newPage();
	page.setViewport({
		width: options?.width??640,
		height: options?.height??480,
		deviceScaleFactor: options?.scale??1,
	})

	await createSnapshot(element);
	const html = await generateHTMLPage(renderHTMLProvider, await getOuterHTML(element), RenderMethod.STATIC, ['uix/app/client-scripts/default.ts'], ['uix/style/document.css'], ['uix/style/body.css'])
	logger.info("loading page");

	await page.setContent(html);
	await page.waitForNetworkIdle();
	await sleep(2000);
	await page.screenshot({ path: path.pathname });

	if (!options?._debug) {
		// close browser instance after some time
		browserCloseTimeout = setTimeout(async ()=>{
			await browser?.close();
			browser = undefined;
		}, 60_000)
	}

	return convertToWebPath(path, true);
}

async function installPuppeteer(){
	const version = "16.2.0";
	// logger.error("please install puppeteer: " + "PUPPETEER_PRODUCT=chrome deno run -A --unstable https://deno.land/x/puppeteer@16.2.0/install.ts")
	logger.info("installing puppeteer v." + version);
	await Deno.run({cmd:["deno", "run", "-A", "--unstable", "https://deno.land/x/puppeteer@"+version+"/install.ts"]}).status();
}