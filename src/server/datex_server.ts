/**
 * DATEX ComInterface with web server (TCP / HTTP / Websockets)
 */

import { Datex , pointer, meta, expose, scope, datex } from "datex-core-legacy";
import { Server } from "./server.ts";
import type { ComInterface, datex_meta } from "datex-core-legacy/datex_all.ts";
import { logger } from "../utils/global-values.ts";

/** common class for all interfaces (WebSockets, TCP Sockets, GET Requests, ...)*/
export abstract class ServerDatexInterface implements Datex.ComInterface {

    type = "unknown";

    in = true
    out = true

    // is_bidirectional_hub = true

    endpoints: Set<Datex.Endpoint> = pointer(new Set<Datex.Endpoint>());
    reachable_endpoints: Map<Datex.Endpoint, Datex.Endpoint> = pointer(new Map()); // <requested_endpoint, reachable_via_endpoint connection>

    private static instance: ServerDatexInterface;
    protected logger:Datex.Logger;
    protected datex_in_handler:(dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array> | {dxb: ArrayBuffer|ReadableStreamDefaultReader<Uint8Array>; variables?: any; header_callback?: (header: Datex.dxb_header) => void}, last_endpoint: Datex.Endpoint, source?:ComInterface) => Promise<Datex.dxb_header|void>;

    public static getInstance() {
        // @ts-ignore
        if (!this.instance) this.instance = new this();
        return this.instance;
    }

    public disconnect(){
        // TODO what to do on disconnect?
    }

    protected endpointWelcomeMessage(endpoint: Datex.Target) {
        return;
    }
    
    protected constructor() {
        this.logger = new Datex.Logger(this.constructor.name);
        this.datex_in_handler = Datex.Runtime.getDatexInputHandler();
    }

    abstract init(): void

    protected handleBlock(dxb:ArrayBuffer, last_endpoint: Datex.Endpoint, header_callback?:(header:Datex.dxb_header)=>void, source?:any):Promise<Datex.dxb_header> {
        if (header_callback) return <Promise<Datex.dxb_header>>this.datex_in_handler({dxb, header_callback}, last_endpoint, source??this);
        else return <Promise<Datex.dxb_header>>this.datex_in_handler(dxb, last_endpoint, source??this);
    }

    /** implement how to send a message to a connected node*/
    protected abstract sendRequest(dx:ArrayBuffer, to:Datex.Target):Promise<void>|void

    /** called from outside for requests */
    public send(dx:ArrayBuffer, to?:Datex.Target) {
        if (!to) throw new Error("no target specified")
        return this.sendRequest(dx, to)
    }

    // TODO should find the right communication way (sockets, ... ) depending on station!
    /*public static async send(dx:AsyncGenerator<ArrayBuffer,ArrayBuffer>, to:DatexFilterTarget):Promise<void> {
        let com_interface = RouterDatexInterface.endpoints_connection_points.get(to);
        if (com_interface) return com_interface.send(dx, to);
    }*/

}



/** HTTP interface */
class HttpComInterface extends ServerDatexInterface {

    override type = "http";

    override in = true
    override out = false

    public server?: Server

    init() {

        // create a new server
        if (!this.server) {
            this.server = new Server(r=>this.handleRequest(r));
            this.server.listen();
        }
        // use an existing server (might also be used as a normal HTTP server)
        else {
            this.server.addRequestHandler(r=>this.handleRequest(r), true);
        }

    }

    private upgrade_handlers = new Map<string, (req:Deno.RequestEvent)=>void>()

    public addUpgradeHandler(type:string, handler:(req:Deno.RequestEvent)=>void){
        this.upgrade_handlers.set(type, handler);
    }

    protected async handleRequest(requestEvent:Deno.RequestEvent){
        const upgrade = requestEvent.request.headers.get("upgrade")

        // custom upgrade handler (for websockets)
        if (upgrade && this.upgrade_handlers.has(upgrade)) {
            this.upgrade_handlers.get(upgrade)?.(requestEvent);
        }
        else if (requestEvent.request.method == "POST" && new URL(requestEvent.request.url).pathname == "/datex-http") {
            const dxb = await requestEvent.request.arrayBuffer()
            await Datex.InterfaceManager.datex_in_handler(dxb, Datex.BROADCAST, this);
            requestEvent.respondWith(new Response("Ok"));
        }   
        else return false;
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Endpoint) {
        //return null;
        // TODO cache requests
    }

}


type push_data = {endpoint:string, expirationTime:any, keys:{p256dh:string, auth:string}};

/** Web push interface */
class WebPushInterface extends ServerDatexInterface  {

    override type = "webpush";

    override in = false
    override out = true

    private static publicKey = 'BEurqeNZ1qqnY3BzL17tu-pMusRWr2zIxw4nau7nkTYQqeMYjV31s_l6DUP-AaV1VDYvOJYRfxfQQqlFvITg01s'
    private static privateKey = 'hshlp0C6kowCz6tgs8g-ZDRyyqHJXEcY1orM8AAe2WU'

    private saved_push_connections = new Map<Datex.Target, push_data>();

    init() {
        this.logger.debug("init")
        // webpush.setVapidDetails('mailto:admin@unyt.org', WebPushInterface.publicKey, WebPushInterface.privateKey);
    }

    public registerChannel(endpoint:Datex.Target, data:push_data): boolean{
        this.saved_push_connections.set(endpoint, data);

        // assign interface officially to this endpoint
        Datex.CommonInterface.addInterfaceForEndpoint(endpoint, this);

        return true;
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Target) {

        // // check if push subscription exists
        // if (this.saved_push_connections.has(to)) {
        //     let subscription = this.saved_push_connections.get(to);
        //     //let buffer = Buffer.from(dx);
        //     let base64 = btoa(String.fromCharCode(...new Uint8Array(dx)));
        //     let result = await webpush.sendNotification(subscription, base64)//DatexRuntime.decompile(dx, false, false));
        //     this.logger.success("-> push notification to " + to.toString(), result);
        // }

        // return null;
        // TODO cache requests
    }

}


/** TCP CLI (e.g. via netcat) */
// TODO: convert from node to deno
class TCPCLI extends ServerDatexInterface  {

    override type = "tcp_cli";

    override in = true
    override out = true

    private tcp_server;

    private introText(){
        return `
        [30;107m                [0m
      [30;107m  [0m[30;40m                [0m[30;107m  [0m
    [30;107m  [0m[30;40m                    [0m[30;107m  [0m                                           [30;107m  [0m
   [30;107m  [0m[30;40m        [0m[30;107m      [0m[30;40m        [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m        [0m    [30;107m  [0m      [30;107m  [0m  [30;107m      [0m
   [30;107m  [0m[30;40m       [0m[30;107m        [0m[30;40m       [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m    [30;107m  [0m
   [30;107m  [0m[30;40m        [0m[30;107m      [0m[30;40m        [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m    [30;107m  [0m
   [30;107m  [0m[30;40m     [0m[30;46m      [0m[30;101m      [0m[30;40m     [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m  [30;107m          [0m    [30;107m  [0m
   [30;107m  [0m[30;40m    [0m[30;46m       [0m[30;101m       [0m[30;40m    [0m[30;107m  [0m    [30;107m  [0m      [30;107m  [0m  [30;107m  [0m      [30;107m  [0m        [30;107m  [0m      [30;107m  [0m
   [30;107m  [0m[30;40m     [0m[30;46m     [0m[30;40m  [0m[30;101m     [0m[30;40m     [0m[30;107m  [0m      [30;107m        [0m  [30;107m  [0m      [30;107m  [0m        [30;107m  [0m      [30;107m  [0m[90m  0.0.1a[0m
    [30;107m  [0m[30;40m                    [0m[30;107m  [0m                                   [30;107m  [0m
      [30;107m  [0m[30;40m                [0m[30;107m  [0m                                 [30;107m      [0m
        [30;107m                [0m


  Connected via [92m${process.env.UNYT_NAME.replace("ROUDINI-", "").replace(/\-/g, '.')}[0m (wss)
[92m
  [MODE]      [0mProduction[92m
  [APP]       [0m:unyt[92m
  [LICENSE]   [0mUnyt Corporation[92m
  [STATION]   [0m?[36m

  Enable debug mode for this endpoint: https://r.unyt.cc/@jonas[0m

  © 2022 Jonas & Benedikt Strehle



[97m> [0m`
    }

    init() {
        this.logger.debug("init")

        this.tcp_server = TCP.createServer((conn) => {

            conn.setEncoding('utf8')
                    
            conn.write(this.introText(), async function () {
                //console.log("input")
            })
          
            conn.on("error", console.log)
          
            conn.on("end", () => {

            })
          
            conn.on("data", async (message) => {
                let message_string = message.toString();
                console.log("==> A Connection says:\n%s", message);
                // fixme: executes locally
                try {
                    let res = await datex(message_string);
                    if (res !== Datex.VOID) conn.write(res + "\n");
                } catch (e) {
                    conn.write("[30;31m" + e + "[0m\n");
                }
                conn.write("[97m> [0m");
            })
        })
        
        const port = process.env.UNYT_TCP_PORT;

        this.tcp_server.listen(port, () => {
            this.logger.success(`TCP CLI Server is listening on port ${port}`)
        });
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Target) {

    }
}

type TCPSocket = TCP.Socket;


/** TCP server interface */
// TODO: convert from node to deno
class TCPComInterface extends ServerDatexInterface  {

    override type = "tcp";

    override in = true
    override out = true

    private tcp_server;

    private connection_endpoint_map: Map<TCPSocket, Datex.Endpoint> = new Map()
    private endpoint_connection_map: Map<Datex.Endpoint, TCPSocket> = new Map()

    init() {
        this.logger.debug("init")

        this.tcp_server = TCP.createServer((conn) => {
        
            conn.on("error", console.log)
          
            conn.on("end", () => {

            })
          
            conn.on("data", async (dx_block) => {
                // convert Buffer to ArrayBuffer and parse block
                let header:Datex.dxb_header;

                console.log("TCP data:", dx_block)

                let conn_endpoint = this.connection_endpoint_map.get(conn);

                // bind alias to this socket connection
                if (!conn_endpoint) {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, null, header => {
                        this.logger.debug("tcp endpoint registered: " + header.sender);

                        this.endpoints.add(header.sender)
                        // assign interface officially to this endpoint
                        Datex.CommonInterface.addInterfaceForEndpoint(header.sender, this);
                        this.endpoint_connection_map.set(header.sender, conn);
                        this.connection_endpoint_map.set(conn, header.sender);
                        this.endpointWelcomeMessage(header.sender);
                    })
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, conn_endpoint, null)
                }

                /* an other endpoint is reachable over this interface*/
                if (header && header.sender!=conn_endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.reachable_endpoints.set(header.sender, conn_endpoint)
                    Datex.CommonInterface.addIndirectInterfaceForEndpoint(header.sender, this)
                }
                

            })
        })
        
        const port = process.env.UNYT_TCP_PORT;

        this.tcp_server.listen(port, () => {
            this.logger.success(`TCP Server is listening on port ${port}`)
        });
    }

    protected async sendRequest(dx:ArrayBuffer, to:Datex.Endpoint) {
        let buffer = Buffer.from(dx);

        // try to find an other endpoint over which the requested endpoint is connected
        if (!this.endpoint_connection_map.has(to)) {
            if (this.reachable_endpoints.has(to)) to = this.reachable_endpoints.get(to);
            else {this.logger.error("alias " + to + " not connected");return;}
        }

        // send to a connected endpoint
        else this.endpoint_connection_map.get(to).write(buffer)
    }
}

/** Websocket stream interface */
class WebsocketStreamComInterface extends ServerDatexInterface {

    private wss;

    override in = true
    override out = true

    override type = "wss";

    private connected_endpoint_streams = new Map<Datex.Target, any>();

    init() {
        this.logger.debug("init")


        this.wss = new WebSocket.Server({
            //port: port,
            server: WebServer.http,
            perMessageDeflate: {
                zlibDeflateOptions: {
                    // See zlib defaults.
                    chunkSize: 1024,
                    memLevel: 7,
                    level: 3
                },
                zlibInflateOptions: {
                    chunkSize: 10 * 1024
                },
                // Other options settable:
                clientNoContextTakeover: true, // Defaults to negotiated value.
                serverNoContextTakeover: true, // Defaults to negotiated value.
                serverMaxWindowBits: 10, // Defaults to negotiated value.
                // Below options specified as default values.
                concurrencyLimit: 10, // Limits zlib concurrency for perf.
                threshold: 1024 // Size (in bytes) below which messages
                // should not be compressed.
            }
        });
        this.logger.success(`WebSocket stream server is listening`)


        this.wss.on('connection', async ws => {
            console.log("new connection")

            let ws_stream = websocketStream(ws);

            ws_stream.on('data', async (dx_block :Buffer) => {
                // convert Buffer to ArrayBuffer and parse block
                let header:Datex.dxb_header;

                // bind alias to this socket connection
                if (!ws_stream.endpoint) {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, ws_stream.endpoint, header => {
                        
                        this.connected_endpoint_streams.set(header.sender, ws_stream);
                        this.endpoints.add(header.sender)
                        // assign interface officially to this endpoint
                        Datex.CommonInterface.addInterfaceForEndpoint(header.sender, this);
                        
                        ws_stream.endpoint = header.sender;
                        this.endpointWelcomeMessage(header.sender);
                    })
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dx_block).buffer, ws_stream.endpoint, null)
                }

                /* an other endpoint is reachable over this interface*/
                if (header && header.sender!=ws_stream.endpoint && !this.reachable_endpoints.has(header.sender)) {
                    this.reachable_endpoints.set(header.sender, ws_stream.endpoint)
                    Datex.CommonInterface.addIndirectInterfaceForEndpoint(header.sender, this)
                }
               
            });
        });
    }

    protected sendRequest(dx:ArrayBuffer, to:Datex.Endpoint) {

        // try to find an other endpoint over which the requested endpoint is connected
        if (!this.connected_endpoint_streams.has(to)) {
            if (this.reachable_endpoints.has(to)) to = this.reachable_endpoints.get(to);
            else {this.logger.error("alias " + to + " not connected");return;}
        }

        // send to a connected endpoint
        else {
            try {
                this.connected_endpoint_streams.get(to).write(dx)
            }
            catch (e) {
                console.log(e)
            }
        }
    }
}

/** Websocket interface */
class WebsocketComInterface extends ServerDatexInterface {

    override type = "websocket";
    description?: string

    override in = true
    override out = true

    private connected_endpoints = new Map<Datex.Target, any>();
    private socket_endpoints = new WeakMap<WebSocket, Datex.Endpoint>() 

    public get activeConnections() {
        return this.connected_endpoints.size
    }

    init() {
        this.logger.debug("init");

        // http interface required
        DatexServer.http_com_interface.init();
        DatexServer.http_com_interface.addUpgradeHandler("websocket", (r)=>this.handleRequest(r));        
    }

    isEqualSource(source: ComInterface, to: Datex.Endpoint) {
        const socketEndpoint = this.getReachableEndpointRedirectEndpoint(to);
        return socketEndpoint && (source.endpoint?.equals(socketEndpoint) || source.endpoint?.main?.equals(socketEndpoint));
    }

    private handleRequest(requestEvent:Deno.RequestEvent){
        try {
            const req = requestEvent.request; 
            if (req.headers.get("upgrade") != "websocket") {
                return new Response(null, { status: 501 });
            }

            const { socket, response } = Deno.upgradeWebSocket(req);
            requestEvent.respondWith(response);

            // infer ws url
            this.description = requestEvent.request.url
                .replace("http://localhost", "ws://localhost")
                .replace("http://", "wss://")
                .replace("https://", "wss://");
            if (this.description.endsWith("/")) this.description = this.description.slice(0, -1);

            const dispose = () => {
                const endpoint = this.socket_endpoints.get(socket)!;
                this.connected_endpoints.delete(endpoint)
                this.socket_endpoints.delete(socket)
            }

            socket.onclose = dispose
            socket.onerror = dispose

            const proxySource:{type:string, description: string, endpoint?:Datex.Endpoint} = {type: this.type, description: this.description};

            socket.onmessage = async (e:MessageEvent<ArrayBuffer>) => {

                const dmx_block = e.data;

                let header: Datex.dxb_header;

                // bind endpoint to this socket connection
                if (!this.socket_endpoints.has(socket)) {
                    header = await this.handleBlock(new Uint8Array(dmx_block).buffer, undefined, header => {
                        this.logger.debug("endpoint registered: " + header.sender);
                        
                        this.connected_endpoints.set(header.sender, socket);
                        this.endpoints.add(header.sender)

                        proxySource.endpoint = header.sender;

                        // assign interface officially to this endpoint
                        Datex.CommonInterface.addInterfaceForEndpoint(header.sender, this);

                        this.socket_endpoints.set(socket, header.sender)
                    }, proxySource)
                }
                else {
                    header = await this.handleBlock(new Uint8Array(dmx_block).buffer, this.socket_endpoints.get(socket), null, proxySource)
                }

                /* an other endpoint is reachable over this interface*/
                if (header && header.sender!=this.socket_endpoints.get(socket) && !this.reachable_endpoints.has(header.sender)) {
                    this.logger.debug("reachable endpoint registered: " + header.sender);
                    this.reachable_endpoints.set(header.sender, this.socket_endpoints.get(socket))
                    Datex.CommonInterface.addIndirectInterfaceForEndpoint(header.sender, this)
                }
            };
        }
        catch (e) {
            console.log("Socket Error 1", e)
        }

    }

    protected getReachableEndpointRedirectEndpoint(endpoint:Datex.Endpoint) {
        if (this.reachable_endpoints.has(endpoint)) return this.reachable_endpoints.get(endpoint)
        else {
            for (const [reachableEndpoint, redirect] of this.reachable_endpoints) {
                if (reachableEndpoint.main === endpoint) return redirect
            }
        }
    }
    protected getConnectedEndpointSocket(endpoint:Datex.Endpoint) {
        if (this.connected_endpoints.has(endpoint)) return this.connected_endpoints.get(endpoint)
        else {
            for (const [connectedEndpoint, socket] of this.connected_endpoints) {
                if (connectedEndpoint instanceof Datex.Endpoint && connectedEndpoint.main === endpoint) return socket
            }
        }
    }

    protected sendRequest(dx:ArrayBuffer, to:Datex.Endpoint) {
        // try to find an other endpoint over which the requested endpoint is connected
        let connectedEndpointSocket = this.getConnectedEndpointSocket(to);
        if (!connectedEndpointSocket) {
            to = this.getReachableEndpointRedirectEndpoint(to)!;
            if (to) connectedEndpointSocket = this.getConnectedEndpointSocket(to);
            else {logger.debug(to + " not reachable via redirect");return;}
        }

        // send to a connected endpoint
        if (connectedEndpointSocket) {
            try {
                connectedEndpointSocket.send(dx)
            }
            catch (e) {
                this.socket_connection.delete(connectedEndpointSocket);
                this.connected_endpoints.delete(to);
                console.log("Socket Error sending to " + to, e);
            }
        }
    }
}


// deno-lint-ignore no-namespace
export namespace DatexServer {

    export const http_com_interface = <HttpComInterface> HttpComInterface.getInstance();
    export const websocket_stream_com_interface = <WebsocketStreamComInterface> WebsocketStreamComInterface.getInstance();
    export const websocket_com_interface = <WebsocketComInterface> WebsocketComInterface.getInstance();
    export const tcp_com_interface  = <TCPComInterface> TCPComInterface.getInstance();
    export const tcp_cli_com_interface  = <TCPCLI> TCPCLI.getInstance();

    export const web_push_interface = <WebPushInterface> WebPushInterface.getInstance();
    
    export async function init(interfaces=["http", "tcp", "tcp_cli", "websocket", "websocketstream", "webpush"], parent_node?:Datex.Endpoint, server?:Server) {


        
        if (parent_node) {
            console.log("Connecting to parent node: " + parent_node);
            await Datex.Supranet.connect(undefined, true, undefined, undefined, parent_node);
        }
        else {
            await Datex.Supranet.init();
        }
        
        addInterfaces(interfaces, server)
    }

    export function addInterfaces(interfaces = ["http", "tcp", "tcp_cli", "websocket", "websocketstream", "webpush"], server?:Server) {
            
        // use existing server for http com interface
        if (server) http_com_interface.server = server;

        // init all interfaces
        if (interfaces.includes("http")) {
            http_com_interface.init();
            Datex.InterfaceManager.addInterface(http_com_interface);
        }
        if (interfaces.includes("tcp")) {
            tcp_com_interface.init();
            Datex.InterfaceManager.addInterface(tcp_com_interface);
        }
        if (interfaces.includes("tcp_cli")) {
            tcp_cli_com_interface.init();
            Datex.InterfaceManager.addInterface(tcp_com_interface);
        }
        if (interfaces.includes("websocket")) {
            websocket_com_interface.init();
            Datex.InterfaceManager.addInterface(websocket_com_interface);
        }
        if (interfaces.includes("websocketstream")) {
            websocket_stream_com_interface.init();
            Datex.InterfaceManager.addInterface(websocket_stream_com_interface);
        }
        if (interfaces.includes("webpush")) {
            web_push_interface.init();
            Datex.InterfaceManager.addInterface(web_push_interface);
        }

        Datex.InterfaceManager.enable();
    }
    
}


// override interface manager methods

Datex.InterfaceManager.handleNoRedirectFound = function(receiver){
    logger.debug("cannot redirect to " + receiver);
}




/** Custom ROUDINI stuff */

@scope("network") abstract class network {
    
    /** add push notification channel connection data */
    @meta(2)
    @expose static async add_push_channel (channel:string, data:push_data, meta:datex_meta) {
        console.log("new push endpoint: " + meta.sender.getInstance(channel).toString());
        return DatexServer.web_push_interface.registerChannel(meta.sender.getInstance(channel), data);
    }

    /** get sign and encryption keys for an alias */
    @expose static async get_keys(endpoint:Datex.Person) {
        // console.log("GET keys for " +endpoint)
        const keys = await Datex.Crypto.getExportedKeysForEndpoint(endpoint);
        return keys;
    }
}