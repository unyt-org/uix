# UIX app communication in the Supranet

This chapter provides a comprehensive overview of data transfer strategies used in UIX apps.
It provides background knowledge that is not directly relevant to the development of UIX applications, but can be useful in understanding the underlying mechanics of DATEX/UIX.

<b>Legend:</b>

<img height=200  src="./res/communication/legend.svg"/>

## Providing files over HTTP

When a UIX backend server is directly accessible from the frontend via a public IP address, static files are transferred via HTTP from the backend to the frontend (The graphic is simplified and does not show the HTTP request/response separately):

![](./res/communication/static-file.svg)


## HTTP-over-DATEX

If the UIX backend is not accessible via a public IP address, static data can still be served to the frontend client via HTTP by using [HTTP-over-DATEX tunneling](./Glossary.md#http-over-datex) between the backend endpoint and a public relay endpoint:

![](./res/communication/static-http-over-datex.svg)

## Transferring data via DATEX

Most data in a UIX app can also be transferred directly via DATEX (some resources can currently only be transferred via HTTP, e.g. CSS files or JavaScript modules).
DATEX is especially useful for dynamic (reactive) data, but can also be used to transfer static data.

![](./res/communication/dynamic-datex.svg)

## Hybrid rendering with HTTP and DATEX

When using [hybrid rendering](./08%20Rendering%20Methods.md#hybrid-rendering), static HTML content is first served over HTTP and then hydrated with dynamic DATEX data:

![](./res/communication/hybrid-datex-http.svg)

## Communication between endpoints via DATEX

DATEX is used to communicate with third-party endpoints or between client endpoints in the same app.

This can be achieved by communicating through a public endpoint relay server:

![](./res/communication/third-party-endpoint.svg)
![](./res/communication/end-to-end-relay.svg)

Alternatively, the UIX app backend can also serve as a relay server:

![](./res/communication/end-to-end-backend.svg)

## Direct communication between endpoints via DATEX

It is also possible for two frontend endpoints to communicate directly via DATEX without a relay server. This can be achieved using end-to-end communication channels such as WebRTC or DOM communication (iframe/window).

![](./res/communication/direct-connection.svg)

> [!NOTE]
> This diagram simplifies how a WebRTC connection works. For a more detailed explanation, see [WebRTC Communication Interfaces](https://docs.unyt.org/manual/datex/communication-interfaces#webrtc)

## DATEX-over-HTTP

If no DATEX connection can be established (e.g. if the DATEX runtime is not loaded on a client), [DATEX-over-HTTP](./Glossary.md#datex-over-http) can be used to send DATEX scripts over HTTP.

Similarly, the [HTTP Communication Interface](https://docs.unyt.org/manual/datex/communication-interfaces#http) can be used to send DATEX binary blocks over HTTP.

![](./res/communication/datex-over-http.svg)