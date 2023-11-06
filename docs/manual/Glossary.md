# Glossary


## HTTP-over-DATEX

HTTP tunneling over DATEX. This allows local web servers
to be accessible via a public IP or domain (e.g *.unyt.app).

HTTP-over-DATEX is enabled per default. To disable it, run your
UIX app with `--http-over-datex=false`.

> [!WARNING]
> The current implementation of HTTP-over-DATEX does not support HTTPS
> between the local web server and the public relay 
> (e.g. a public unyt.app endpoint), meaning that all HTTP traffic 
> is transmitted without encryption.
> There is still DATEX encryption between your backend endpoint and
> the HTTP relay endpoint, aswell as HTTPS encryption between the
> HTTP relay endpoint and the browser client, but the relay endpoint could
> in theory read and modify all HTTP requests and
> responses inbetween.


## DATEX-over-HTTP

Allows an HTTP client with a [verified endpoint session](#verified-endpoint-session) to send DATEX messages over HTTP.
This can be done without an active DATEX runtime on the client.
DATEX-over-HTTP only supports JSON as input and output.

Pointer synchronization and DATEX messages sent from the server are also not suppported 
when using DATEX-over-HTTP.

## Verified Endpoint Session

A browser session that is associated with an endpoint and a signated validation token.
This allows the backend to reliably associate HTTP requests with endpoints.

Whenever a UIX page is opened, a new endpoint session is created if there is no active session.
The session endpoint can be accessed from the `Context` object: 
```ts
export default ctx => console.log("session endpoint: " + ctx.endpoint) satisfies Entrypoint;
```