/*******************************************************************************************
 * ╔══════════════════════════════════════════════════════════════════════════════════════╗ *
 * ║ UNYT - # - WebServer                                                                 ║ *
 * ╠══════════════════════════════════════════════════════════════════════════════════════╣ *
 * ║ General Web server                                                                   ║ *
 * ║                                                                                      ║ *
 * ╠═════════════════════════════════════════╦════════════════════════════════════════════╣ *
 * ║  © 2020 Jonas & Benedikt Strehle        ║ ██████████████████████████████████████████ ║ *
 * ╚═════════════════════════════════════════╩════════════════════════════════════════════╝ *
 *******************************************************************************************/


/** Imports **/

// ---
import { Logger } from "unyt_core/utils/logger.ts";
import { getCallerDir } from "unyt_core/utils/caller_metadata.ts";
import type { Cookie } from "https://deno.land/std@0.177.0/http/cookie.ts";
import { Path } from "../utils/path.ts";
import { TypescriptTranspiler } from "./ts_transpiler.ts";
import { addCSSScopeSelector } from "../utils/css-scoping.ts";
import { client_type } from "unyt_core/utils/constants.ts";

const { highlightText } = client_type === "deno" ? await import('https://cdn.jsdelivr.net/gh/speed-highlight/core/dist/index.js') : {highlightText:null};

const { setCookie, getCookies } = client_type === "deno" ? (await import("https://deno.land/std@0.177.0/http/cookie.ts")) : {setCookie:null, getCookies:null};
const fileServer = client_type === "deno" ? (await import("https://deno.land/std@0.164.0/http/file_server.ts")) : null;

const logger = new Logger("UIX Server");


let port = 80;
let customPort = false;
let enable_tls = false;


const langsByExtension = {
    'ts': 'ts',
    'tsx': 'ts',
    'js': 'js',
    'jsx': 'js',
    'css': 'css',
    'scss': 'css',
    'xml': 'xml',
    'rs': 'rs',
    'json': 'json',
    'html': 'html'
}

const defaultKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCnGaK8mPqzlUcX
uUgD0PTXbQu6MMgyryLx1VsGQV4oxQsUrllRGh1ILTe8l+X22uJiZlAL6Y9vp3k9
WtFor35rAyXTSx9LjRUjKN3pd2xCXMARQujdSzUA3GTFtHmZ7lZwNZ65PVnYr3kh
JCwQwJRy60pUqMfbL/34xl3KppoPK2xMkg27xbCWMk/jkoNGYd+Zp+HJs8uUkZFO
8HO10tvdlVAEngMMAS3rrFGXHewgM+ISOs6X9KruhohK/CbZCl9M/2211XRYosQf
Zxu6oVbJCMNmhv+pMbZmqAHezFjJ2K8DMtBGPWEhtaCFhqfve/3lzExYFPhHE+B1
g09CLVwZAgMBAAECggEARn6KKQZgvWI8m8WOnA2LPVbDm8j4rGk2VM+tlvX8wzZd
dlwXUh+yOsDYwrdSTNIKr3h6TIw79t6wRzIJJiDjNEIfswP+L+FVCYA0HkpDYbu/
S4jutG0F71cLLFz27/mcfbohPASl4sQkVdbswCR+e/zHXu/VYKLeghUtfFDMrZj1
XtDuCynbIgaTb7TZ4XuJ3gWYG8+VpzSpTW99Cwy13eYQPfOL07xFzA1pt7iqsqf+
9nC8tdSFzUfTrTt6C7XCZ64r6cViBjrSODOovaQzbg40X8bD3zXpkygdaZFytPku
vmoD2srykRi+l/KuLjf1xlWx6BBqafMP0uebr+bAAQKBgQDZOlXgnCClkWX1qdbi
x4ew2TUQef2ShffUU7lwPVjDuxDaUT/F+N8IbG7aguWD1rbhXtFer88j/I6M6ued
rQOH/f5O0oNvNX3TxehzzD/2y25lz3e5lJPUy5/l4mVhSNjQzfEa8IwurIZ+0poJ
Cd1s4wH+LWGf+2rwrQQMum6l7QKBgQDE7NfotyCKUO46UMRtU2UKXe9ae8npvCJ5
aAW7OZJh0HskxkvHFNYO5sQUEYgWs2Onh7YAJG502rs7egOUXVyi40ubHFht6yxq
izfVGrR55Uqjrs7xlKydX5vOyQFfJe0quvQOxY4cRawF/SJ9aDqteJwnq0WLT4j+
ivJiUATJXQKBgGDMkgApEpM1G45BRLSB3YF9CRxygACPGkTPmk7dx3RRI81lb1m0
8Q4745oTwlrhj1UWf44GIfQTUyKQeu3Ub0JmeLB/NnqUB6IbCt6vIcHEHUnZDazw
/H9SzcoO/MZBQ/yoCMzMbGtQDg7toh5s+vLOpdCyQFKeIqVlM+zIFw5xAoGAaD7M
qRfQNQhUpDA/W3RrJ4rEe0zOfVonkcdcSVlXwUoA9l22naPNEUReBhWlygaauYPg
98BRbLChrwGPRYoK0Pur+WeO9FkrQReDrd8eLO0Rjwap7D79Ba4oJ9ZGUJ0eKKGh
MvSnnxXO07jF+kcj0NLpLyK+hNnMtprNZvffIM0CgYEAulnW4RinIqp/j1kXxSt7
Y1GkmN8ozem89ZKXz3zTEKvhqQfB+fMIhFzJ2i31eGe8NM6B2M8RVzeZ3JB0SXib
MuebKARKYi4+MTkZbQ2SgFZY3K2pKybB9GQFvY96k1kWfYQc3xbQZ7gZrqQt1xkM
T9s26OLs23b9HZE5XEfxmX8=
-----END PRIVATE KEY-----`;

const defaultCert = `-----BEGIN CERTIFICATE-----
MIIEeTCCAuGgAwIBAgIQeObf9HHX+G5b1bCKfBeukjANBgkqhkiG9w0BAQsFADCB
pzEeMBwGA1UEChMVbWtjZXJ0IGRldmVsb3BtZW50IENBMT4wPAYDVQQLDDVqb25h
c0BNYWNCb29rLVByby12b24tSm9uYXMuZnJpdHouYm94IChKb25hcyBTdHJlaGxl
KTFFMEMGA1UEAww8bWtjZXJ0IGpvbmFzQE1hY0Jvb2stUHJvLXZvbi1Kb25hcy5m
cml0ei5ib3ggKEpvbmFzIFN0cmVobGUpMB4XDTIzMDQxNjE4MjkzOFoXDTI1MDcx
NjE4MjkzOFowaTEnMCUGA1UEChMebWtjZXJ0IGRldmVsb3BtZW50IGNlcnRpZmlj
YXRlMT4wPAYDVQQLDDVqb25hc0BNYWNCb29rLVByby12b24tSm9uYXMuZnJpdHou
Ym94IChKb25hcyBTdHJlaGxlKTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBAKcZoryY+rOVRxe5SAPQ9NdtC7owyDKvIvHVWwZBXijFCxSuWVEaHUgtN7yX
5fba4mJmUAvpj2+neT1a0WivfmsDJdNLH0uNFSMo3el3bEJcwBFC6N1LNQDcZMW0
eZnuVnA1nrk9WdiveSEkLBDAlHLrSlSox9sv/fjGXcqmmg8rbEySDbvFsJYyT+OS
g0Zh35mn4cmzy5SRkU7wc7XS292VUASeAwwBLeusUZcd7CAz4hI6zpf0qu6GiEr8
JtkKX0z/bbXVdFiixB9nG7qhVskIw2aG/6kxtmaoAd7MWMnYrwMy0EY9YSG1oIWG
p+97/eXMTFgU+EcT4HWDT0ItXBkCAwEAAaNeMFwwDgYDVR0PAQH/BAQDAgWgMBMG
A1UdJQQMMAoGCCsGAQUFBwMBMB8GA1UdIwQYMBaAFN5vUfpPJhbCA6P2BCwZZ9zM
x+ihMBQGA1UdEQQNMAuCCWxvY2FsaG9zdDANBgkqhkiG9w0BAQsFAAOCAYEAhn8o
Hk5rEC/XerIEW4l8TmB2k9xc9rhMuM+1QsJx2uy4lR0BYp5aDk4BX2dMTLAPLEJe
m0sI7LCuKkF1pfIVf1CflBzIWi9cfgNcNijGHZ21ODQ12oEU0MdPQIgLOWMOM4Ys
o4xpEMWj9k89A3bXKU+pNlQygLKoxZfPR+R1AGLvQHEUR48alBgk812VJwuo1oZu
w2jjh/0+sc+g7Mh7uQvmFSkPIsbNSHVj+JVS8w/oDX3xZwvwrQFsriHxwgP6qqs2
KOV5MIfEN1mZsE0fJ1RFWjjz+d5KsvI8UY8vtfarZRAbKRFQcyIPftqjz0/wfKb4
o6MxAX6jt9mXEVk7ieXWR72rest4Um66isO+kRR9fXhPcwIJbJyvKBQhSMHah9IR
e/oFUigvXFAk5se3eiyON38Gh1hQGeOYvNC3EFRSOljo3KCrYUeKw50ZH49r295M
q5QoSynNW4FNauxdgU7F+4r5jdKJugaRp84UL/VJzIk93gaJhEpRSAnbDih4
-----END CERTIFICATE-----`



// command line args (--watch)
if (globalThis.Deno) {
    const parse = (await import("https://deno.land/std@0.168.0/flags/mod.ts")).parse;
    const flags = parse(Deno.args, {
        string: ["port", "keyfile", "certfile"],
        boolean: ["enable-tls"],
    });
    if (flags.port) {
        port = Number(flags.port);
        customPort = true;
    }

    enable_tls = flags['enable-tls'];
    // cert_path = Deno.run()
}


// Using Deno.emit in version < 1.21.3, use external deno_emit module as soon es import maps are supported & decorators work correctly!
// const emit = globalThis.Deno ? (await import("https://deno.land/x/emit@0.12.0/mod.ts")).emit : null;


// -------------------------------------------------------------------------------------------------------------------


type mime_type = `${'text'|'image'|'application'|'video'|'audio'}/${string}`;

type connectionHandler = (conn: Deno.Conn)=>void|boolean|Promise<void|boolean>;// when true returned, handle connection with default handler
type requestHandler = (req: Deno.RequestEvent, path:string, con:Deno.Conn)=>void|boolean|string|Promise<void|boolean|string>;// when true returned, request was handled, returned string is passed on to server path handler

type server_options = {
    cors?: boolean, // enable cors, default: false
    transpilers?: {[path:string]: TypescriptTranspiler}, // use transpiler for specific web path, if set, ts files are transpiled, and the js content is returned to the browser (+ virtual files can be added). The transpilers for the first matching path in the list is used. 
    resolve_index_html?: boolean, // resolve / path to index.html, default: false
    request_proxies?: RequestProxy[] // request proxies are called for file requests that match their extensions which are requested directly from a browser session, not as a script import or deno import
                                     // they can be used to provide a custom view for a file in the browser
    directory_indices?: boolean, // returns json directory listing for directory paths, default: true
}

type directoryIndex = ({name:string, children?:directoryIndex}|string)[]

export interface RequestProxy {
    extensions: string[]
    handleRequest(req:Request, originalFilePath:Path, mappedFilePath:Path):Response|undefined|Promise<Response|undefined>
}


export class Server {

    #options!: server_options
    #dir?: Path.File

    #running = false;
    #port = port++

    get running(){return this.#running}
    get port(){return this.#port}
    
    transpilers = new Map<string, TypescriptTranspiler>()

    private requestHandlers = new Set<requestHandler>();
    private connectionHandler?: connectionHandler

    constructor(dir: string|URL, options?:server_options)
    constructor(requestHandler:requestHandler, options?:server_options) 
    constructor(_:undefined, options?:server_options) 
    constructor(requestHandler_or_dir?:string|URL|requestHandler, options?:server_options) {
        if (typeof requestHandler_or_dir == "string") requestHandler_or_dir = new URL(requestHandler_or_dir, getCallerDir())
        this.config(<any>requestHandler_or_dir, options) 
    }

    public config(root?: string|URL, options?:server_options):void
    public config(requestHandler?:requestHandler, options?:server_options):void
    public config(requestHandler_or_root?:string|URL|requestHandler, options?:server_options) {
        if (!fileServer) throw new Error("File Server not supported");

        // default options
        if (!this.#options || options) {
            if (!options) options = {};
            if (!('resolve_index_html' in options)) options.resolve_index_html = false;
            if (!('directory_indices' in options)) options.directory_indices = true;
            this.#options = options;
        }
        
        if (typeof requestHandler_or_root == "string" || requestHandler_or_root instanceof URL) this.#dir = Path.dir(requestHandler_or_root);
        else if (typeof requestHandler_or_root == "function") this.requestHandlers.add(requestHandler_or_root);
        // else throw new Error("Invalid constructor argument for Server, must be file path or connection handler")
        
        for (const [path, transpiler] of Object.entries(this.#options.transpilers??{})) {
            // logger.info("using transpiler for path " + path );
            this.transpilers.set(path, transpiler);
        }

    }

    /** special request handlers */

    private pathHandlers = new Map<string|RegExp, requestHandler>();
    private pathStaticContents = new Map<string|RegExp, [type:mime_type, content:string]>()

    public path(path:string|RegExp, content: string, mime_type: mime_type):void
    public path(path:string|RegExp, handler: requestHandler):void
    public path(path:string|RegExp, handler_or_content: string|requestHandler, mime_type?: mime_type) {
        if (!this.path_request_handler) this.createPathRequestHandler();

        if (typeof handler_or_content == "string") {
            this.pathStaticContents.set(path, [mime_type ?? "text/plain", handler_or_content]);
        }
        else {
            this.pathHandlers.set(path, <requestHandler> handler_or_content);
        }
    }

    public resetPath(path:string|RegExp) {
        this.pathHandlers.delete(path);
        this.pathStaticContents.delete(path);
    }

    private path_request_handler?:requestHandler;

    private createPathRequestHandler(){
        this.path_request_handler = (req:Deno.RequestEvent, req_path:string, conn: Deno.Conn)=>{
            // handler
            for (const [path, handler] of this.pathHandlers) {

                // full string match
                if (typeof path == "string") {
                    if (req_path == path) return handler(req, req_path, conn);
                    else continue;
                }
                // regex match
                else {
                    if (req_path.match(path)) return handler(req, req_path, conn);
                    else continue;
                }
            }  

            // static
            for (const [path, [type, content]] of this.pathStaticContents) {

                // full string match
                if (typeof path == "string") {
                    if (req_path == path) return this.serveContent(req, type, content);
                    else continue;
                }
                // regex match
                else {
                    if (req_path.match(path)) return this.serveContent(req, type, content);
                    else continue;
                }
            }

            return false;
        }
        this.requestHandlers.add(this.path_request_handler)
    }

    public addRequestHandler(requestHandler:requestHandler, prioritize = false){
        if (prioritize) this.requestHandlers = new Set([requestHandler, ...this.requestHandlers]); // put first in line
        else this.requestHandlers.add(requestHandler) // add to end of line
    }


    // start listening on port
    public async listen(port?:number) {
        if (port != undefined) this.#port = port;   

        // logger.info("starting web server...");

        const loaders = []
        for (const [_path, transpiler] of this.transpilers) loaders.push(transpiler.init())
        await Promise.all(loaders)

        const server = await this.listenWithFallbackPort();
        if (this.#dir?.name) logger.info(`${this.#dir.name} available on ${enable_tls?"https":"http"}://localhost${this.port==80?'':':'+this.port}`);
        else logger.info(`available on ${enable_tls?"https":"http"}://localhost${this.port==80?'':':'+this.port}`);
        this.#running = true;

        (async ()=>{
            try {
                for await (const conn of server) {
                    let handled:boolean|void = false;
                    if (this.connectionHandler) handled = await this.connectionHandler(conn) // custom handling
                    // handle default
                    if (handled===false) this.handleConnectionAsHTTP(conn) // handle as http per default
                }
            }
            catch (e){
                console.error("Fatal server error: ", e)
            }
        })()
    }


    private async listenWithFallbackPort() {
        try {
            return this.tryListen(this.port)
        }
        // port not accessible
        catch (e) {
            // only try a different port if default port 80 is used
            if (customPort) throw e;
            const {getAvailablePort} = await import("https://deno.land/x/port@1.0.0/mod.ts");
            const port = await getAvailablePort();
            if (!port) throw "No available port found"
            this.#port = port;
            return this.tryListen(this.port)
        }
    }

    private tryListen(port: number) {
        return enable_tls ? Deno.listenTls({ port, key: defaultKey, cert: defaultCert }) :  Deno.listen({ port });
    }

    public setConnectionHandler(handler:connectionHandler){
        this.connectionHandler = handler;
    }
    
    private async handleConnectionAsHTTP(conn: Deno.Conn){
        const httpConn = Deno.serveHttp(conn);
        try {
            for await (const requestEvent of httpConn) {
                this.handleRequest(requestEvent, conn);
            }
        }
        catch {}
    }

    public async handleRequest(requestEvent:Deno.RequestEvent, conn: Deno.Conn){
        
        let normalized_path:string|false = this.normalizeURL(requestEvent.request);
        let handled:boolean|void|string = false;
        
        // error parsing url (TODO: this should not happen)
        if (normalized_path == false) {
            this.sendError(requestEvent, 500);
            return;
        }

        // TODO: move, uix specific - ignore wss connections
        // TODO style noscript
        if ((this as any)._uix_init && Server.isBrowserClient(requestEvent.request) && (requestEvent.request.headers.get("Sec-Fetch-Dest") == "document" /*|| requestEvent.request.headers.get("Sec-Fetch-Dest") == "iframe"*/) && requestEvent.request.headers.get("connection")!="Upgrade" && !getCookies!(requestEvent.request.headers)["uix-endpoint"]) {
			const html = `<html>
            <noscript>Please activate JavaScript in your browser!</noscript>
            <script type="module" src="${import.meta.resolve('uix/session/init.ts')}"></script>
            `
			await this.serveContent(requestEvent, "text/html", html);
            return;
        }

        for (const handler of this.requestHandlers) {
            try { 
                handled = await handler(requestEvent, normalized_path, conn)
                if (handled!==false) { // request was handled
                    if (typeof handled == "string") { // path redirect
                        normalized_path = handled;
                        handled = false;
                    }
                    else break;
                } 
            } 
            catch {this.sendError(requestEvent)}
        }

        // handle default
        if (handled===false) this.handleHTTPRequest(requestEvent, normalized_path).catch(()=>this.sendError(requestEvent))
    }


    /**
     * Return pathname (relative) from request
     * index.html is added & ts to js file conversion
     * @param requestEvent 
     * @returns normalized path
     */
    private normalizeURL(request: Request){
        const req_url = new Path(request.url);

        // index.html for directory paths
        if (this.#options.resolve_index_html && req_url.is_dir) req_url.pathname += "index.html";

        try {
            return decodeURIComponent(req_url.pathname);
        }
        catch (e) {
            console.log(e);
            return false;
        }
    }

    public static isSafariClient(request:Request){
        const ua = request.headers.get("user-agent");
        if (!ua) return true; // play it safe
        return /^((?!chrome|android).)*safari/i.test(ua);
    }

    public static isBrowserClient(request:Request){
        return !!request.headers.get("user-agent")?.startsWith("Mozilla")
    }


    async handleHTTPRequest(requestEvent: Deno.RequestEvent, normalizedPath?:string) {
        try {
            await requestEvent.respondWith(await this.getResponse(requestEvent.request, normalizedPath))
        } catch {
            try {
                await requestEvent.respondWith(this.getErrorResponse(500))
            }
            catch {}
        }
    }

    getFileSuffix(url: Path, normalizedPath:string):[url: Path, normalizedPath:string, lineNumber:number|undefined, colNumber:number|undefined, contentType:"source"|"transpiled"|undefined] {
        let lineNumber:number|undefined = undefined;
        let colNumber:number|undefined = undefined;
        let contentType:"source"|"transpiled"|undefined = undefined;

        // "line:col:contentType", default contentType = transpiled
        const suffix = /(\:\d+)?(\:\d+)?(\:\w+)?$/;
        const matchSuffix = normalizedPath.match(suffix)
        if (matchSuffix) {
            // extract line + col number
            [lineNumber, colNumber, contentType] = matchSuffix?.slice(1).map(x=>x?.slice(1)).map((x,i) => i==2 ? x : (x?Number(x):x)) as [number|undefined, number|undefined, "source"|"transpiled"|undefined];
            contentType ??= "transpiled" // default for contentType
            normalizedPath = normalizedPath.replace(suffix, '');
            url = new Path(url.toString().replace(suffix, ''));
        }
        
        return [url, normalizedPath, lineNumber, colNumber, contentType]
    }


    async getResponse(request: Request, normalizedPath:false|string = this.normalizeURL(request)) {

        if (!this.#dir || !fileServer || normalizedPath===false) {
            return this.getErrorResponse(500);
        }

        // Use the request pathname as filepath
        let url = new Path(request.url);
        const isBrowser = Server.isBrowserClient(request);
        const isSafari = Server.isSafariClient(request);

        // extract row:col:contentType
        const [newUrl, newNormalizedPath, lineNumber, colNumber, contentType] = this.getFileSuffix(url, normalizedPath);
        url = newUrl;
        normalizedPath = newNormalizedPath;


        // open file in new browser tab => special file preview
        const displayWithSyntaxHighlighting = isBrowser && (request.headers.get("Sec-Fetch-Dest") == "document" || request.headers.get("Sec-Fetch-Dest") == "iframe") && !!url.hasFileExtension("ts", "tsx", "js", "jsx", "css", "scss", "dx")

        const transpile = isBrowser && (displayWithSyntaxHighlighting ? contentType == "transpiled" : true)
        let filepath = this.findFilePath(url, normalizedPath, transpile, isSafari)

        // override filepath, exposes raw source files to browser for debugging TODO: only workaround with _base_path, improve
        if (displayWithSyntaxHighlighting && contentType == "source" && this._app?.stage === "dev" && normalizedPath.startsWith("/@uix/src/")) {
            filepath = (this._base_path as Path.File).getChildPath(normalizedPath.replace("/@uix/src/", ""))
        }
               

        if (!filepath) {
            return this.getErrorResponse(500);
        }

        // handle request by proxy?
        for (const proxy of this.#options.request_proxies??[]) {
            if (url.hasFileExtension(...proxy.extensions) && request.headers.get("sec-fetch-dest") == "document" || request.headers.get("sec-fetch-site") == "none") {
                const response = await proxy.handleRequest(request, this.#dir.getChildPath(normalizedPath), filepath);
                if (response) return response;
            }
        }

        // UIX special query parameters (TODO: move)
        // special scoped css
        if (url.searchParams.has("scope") && (url.ext === "scss" || url.ext === "css")) {
            const scopedCSS = addCSSScopeSelector(await Deno.readTextFile(filepath.normal_pathname), url.searchParams.get("scope")!);
            return this.getContentResponse("text/css", scopedCSS);
        }
        if (url.searchParams.has("useDirective") && (url.ext === "tsx" || url.ext === "ts" || url.ext === "js" || url.ext === "jsx")) {
            const {PageProvider} = await import("../routing/rendering.ts")
            if (!await PageProvider.useDirectiveMatchesForFile(filepath, url.searchParams.get("useDirective")!)) {
                return this.getErrorResponse(406, "Not Acceptable");
            }
        }

        if (this.#options.directory_indices && filepath.fs_is_dir) {
            return this.getContentResponse("application/directory+json", JSON.stringify(await this.generateDirectoryIndex(filepath), null, '    '));
        }

        // is .dx/.dxb file as js module import
        if ((filepath.ext == "dx" || filepath.ext == "dxb") && request.headers.get("Sec-Fetch-Dest") == "script") {

            // check if generated matching dx.ts file exists
            const matchingTsFile = this.findFilePath(url.getWithFileExtension(filepath.ext + '.ts'), normalizedPath + '.ts', isBrowser, isSafari)
            if (matchingTsFile?.fs_exists) {
                filepath = matchingTsFile
            }

            // generate new script importing .dx file (TODO: make sure .dx files are not accidentally leaked from the backend if no .dx.ts file exists)
            else {
                // convert http to https
                if (url.protocol == "http:" && url.hostname !== "localhost") {
                    url.protocol = "https:"
                }
                const script = `import { datex } from "unyt_core";\n\nconst exports = await datex.get("${url}");\nexport default exports;`
                return this.getContentResponse("text/javascript", script);
            }
            
        }

        // render file preview with syntax highlighting in browser
        if (displayWithSyntaxHighlighting) {

            if (!filepath.fs_exists) return this.getErrorResponse(404, "Not found");
            
            const content = await Deno.readTextFile(filepath.normal_pathname);
            const highlighted = await highlightText!(content.replace(/\/\/\# sourceMappingURL=.*$/, ""), langsByExtension[filepath.ext as keyof typeof langsByExtension]);
            const html = `<html>
                <head>
                    <title>${filepath.name}</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/speed-highlight/core@1.2.4/dist/themes/github-dark.css">
                </head>
                <body>
                    <style>
                        body {
                            font-size: 1.2em;
                            background: #282828;
                            color: #eee;
                        }
                        body > div {
                            display: flex;
                        }
                        body > div > div {
                            white-space: pre;
                            font-family: monospace;
                        }
                        
                        .shj-numbers > * {
                            position: relative;
                        }

                        ${lineNumber!==undefined ? `
                        .shj-numbers :nth-child(${lineNumber}):before {
                            color: white;
                        }
                        .shj-numbers :nth-child(${lineNumber}):after {
                            content: 'x';
                            user-select: none;
                            pointer-events: none;
                            color: transparent;
                            position: absolute;
                            top: 0;
                            background: #fff3;
                            width: 100vw;
                            left: -12px;
                            z-index: -100;
                        }
                        `: ''}
                    </style>
                    ${highlighted}
                    ${lineNumber!==undefined ? `
                    <script>
                        document.querySelector('.shj-numbers :nth-child(${lineNumber})').scrollIntoView({behavior:'instant', block:'center'})
                    </script>
                    `: ''}
                </body>
            </html>`

            return this.getContentResponse("text/html", html);
        }
        const response = await fileServer.serveFile(request, filepath.normal_pathname);

        if (this.#options.cors) {
            response.headers.append("Access-Control-Allow-Origin", "*");
            response.headers.append("Access-Control-Allow-Headers", "*");
        }

        return response;
    }


    protected findFilePath(url: Path, normalizedPath: string, resolveTs: boolean, isSafari: boolean) {
        if (!this.#dir || !fileServer) return;

        let filepath = this.#dir.getChildPath(normalizedPath);
          
        try {
            // resolve ts and virtual files
            const resolve_ts = (url.ext==="ts"||url.ext==="tsx"||url.ext==="mts") && url.searchParams.get("type") !== "ts" && resolveTs;
            const compat_mode = isSafari;
            
            for (const [tpath, transpiler] of this.transpilers) {
                if (normalizedPath.startsWith(tpath)) {
                    // create new file path for this transpiler
                    filepath = transpiler.src_dir.getChildPath(normalizedPath.replace(tpath,'/'));

                    // check if transpiler has custom dist path, else use default filepath
                    const dist_path = transpiler.getDistPath(filepath, compat_mode, resolve_ts);

                    if (dist_path) filepath = dist_path;

                    // js file requested that does not exist (this should normally not happen) - try .ts extension
                    // TODO: try all extension (also tsx, ...)
                    else if (!filepath.fs_exists) {
                        if (filepath.hasFileExtension('js', 'mjs')) {
                            const dist_path = transpiler.getDistPath(filepath.getWithFileExtension('ts'), compat_mode, true);
                            if (dist_path) filepath = dist_path;
                        } 
                        // css file does not exists - try scss
                        else if (filepath.hasFileExtension('css')) {
                            const dist_path = transpiler.getDistPath(filepath.getWithFileExtension('scss'), compat_mode, true);
                            if (dist_path) filepath = dist_path;
                        }
                    }
                   
                    break;
                }
            }

        } catch (e) {
            console.log("error handling HTTP Request:",e)
        }

        return filepath;
    }


    protected async generateDirectoryIndex(path: Path.File) {
        const dirs:directoryIndex = []
        const files:directoryIndex = []

        for await(const f of Deno.readDir(path.normal_pathname)) {
            if (f.isDirectory) {
                dirs.push({name: f.name, children: await this.generateDirectoryIndex(path.asDir().getChildPath(f.name))})
            }
            else {
                files.push(f.name)
            }
        }
        return [...files, ...dirs]
    }


    public async serveContent(requestEvent: Deno.RequestEvent, type:mime_type, content:ReadableStream | XMLHttpRequestBodyInit, cookies?:Cookie[], status = 200, headers:Record<string, string>|Headers = {}) {
        const res = this.getContentResponse(type, content, cookies, status, headers)
        try {
            await requestEvent.respondWith(res)
        } catch {}
	}


    public getContentResponse(type:mime_type, content:ReadableStream | XMLHttpRequestBodyInit, cookies?:Cookie[], status = 200, headers:Record<string, string>|Headers = {}) {
        const normalHeaders = headers instanceof Headers ? headers : new Headers(headers);
        if (this.#options.cors) {
            normalHeaders.set("Access-Control-Allow-Origin", "*")
            normalHeaders.set("Access-Control-Allow-Headers", "*")
        }
        normalHeaders.set("Content-Type", type);

        const res = new Response(content, {headers:normalHeaders, status});
        if (cookies) {
            for (const cookie of cookies) setCookie!(res.headers, cookie);
        }
        return res;
	}


    public sendError(requestEvent: Deno.RequestEvent, status = 500, text = "Server Error") {
        return this.serveContent(requestEvent, 'text/plain', text, [], status)
    }

    public getErrorResponse(status = 500, text = "Server Error") {
        return this.getContentResponse('text/plain', text, [], status)
    }
}
