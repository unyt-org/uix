# UIX app communication in the Supranet

This chapter provides an comprehensive overview of data transfer strategies used
within UIX apps.
It provides background knowledge which is normally not relevant for developing UIX applications, but it can be useful to better understand the underlying mechanics of DATEX/UIX.

## Legend
<img height=200  src="./res/communication/legend.svg"/>

# Providing files over HTTP

When a UIX backend server is directly accessible from the frontend via a public IP address,
static files are transmitted via HTTP from the backend to the frontend (The graphic is simplified and does not show the HTTP request/response separately):

![](./res/communication/static-file.svg)


# HTTP-over-DATEX

If the UIX backend is not accessible via a public IP address, static data can still be served with HTTP to the frontend client by using [HTTP-over-DATEX tunneling](./Glossary.md#http-over-datex) between the backend endpoint and a public relay endpoint:

![](./res/communication/static-http-over-datex.svg)

# Transferring data via DATEX

Most data in a UIX app can also be directly transfered via DATEX (Some resources can currently only be transfered via HTTP, e.g. CSS files our JavaScript modules).
DATEX is especially useful for dynamic (reactive) data, but can also be used to transfer static data.

![](./res/communication/dynamic-datex.svg)

# Hybrid rendering with HTTP and DATEX

When using [hybrid rendering](./07%20Rendering%20Methods.md#hybrid-rendering), static HTML content is first served via HTTP and hydrated with dynamic DATEX data afterwards:

![](./res/communication/hybrid-datex-http.svg)

# Communication between endpoints via DATEX

DATEX is used to communicate with third-party endpoints or between client endpoints in the same app.

This can be achieved by communicating via a public endpoint relay server:

![](./res/communication/third-party-endpoint.svg)
![](./res/communication/end-to-end-relay.svg)

Alternatively, the UIX app backend can also serve as a relay server:

![](./res/communication/end-to-end-backend.svg)

# Direct communication between endpoints via DATEX

It is also possible for two frontend endpoints to directly communicate via DATEX without a relay server. This can be achieved with end-to-end communication channels like WebRTC or iframe/window communication.

![](./res/communication/direct-connection.svg)

> [!NOTE]
> This graph simplifies how a WebRTC connection works. For an in-depth explanation,
> take a look at [WebRTC Communication Interfaces](https://docs.unyt.org/manual/datex/communication-interfaces#webrtc)

# DATEX-over-HTTP

If no DATEX connection can be established (e.g. when the DATEX runtime is not loaded on a client), [DATEX-over-HTTP](./Glossary.md#datex-over-http) can be used to send DATEX scripts over HTTP.

Similarly, the [HTTP Communication Interface](https://docs.unyt.org/manual/datex/communication-interfaces#http) can be used to transmit DATEX binary blocks via HTTP.

![](./res/communication/datex-over-http.svg)