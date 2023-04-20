## type **raw_content** = Blob | Response

## type **html_content** = Datex.CompatValue | null | raw_content

## type **html_generator** = unknown - todo

## type **html_content_or_generator** = html_content | html_generator

## type **html_content_or_generator_or_preset** = html_content_or_generator | RenderPreset

## type **EntrypointRouteMap** = {}

## type **Entrypoint** = _Entrypoint | Promise

## interface **RouteManager**
handles routes internally

## interface **RouteHandler**
redirects to other Entrypoints for specific routes

## enum **RenderMethod**

## class **FileProvider**
### Constructors
 **constructor**(path: Path.representation)



## class **EntrypointProxy**
### Constructors
 **constructor**(entrypoint: Entrypoint)


transforms entrypoint content to a new entrypoint content

## class **RenderPreset**\<R extends RenderMethod, T extends html_content_or_generator>
### Constructors
 **constructor**(__render_method: R, __content: T)



## function **renderWithHydration** \<T extends html_content_or_generator>(content: T): RenderPreset


Default: Server side prerendering, content hydration over DATEX
 * @param content: HTML element or text content

## function **renderPreview** \<T extends html_content_or_generator>(content: T): RenderPreset


Default: Server side prerendering, replacing with content on frontend
 * @param content: HTML element or text content

## function **renderStatic** \<T extends html_content_or_generator>(content: T): RenderPreset


Just serve static HTML pages to the frontend, + some frontend JS for functionality,
but content is not loaded over DATEX
 * @param content: HTML element or text content

## function **renderStaticWithoutJS** \<T extends html_content_or_generator>(content: T): RenderPreset


Just serve static HTML pages to the frontend, no frontend JS at all
 * @param content: HTML element or text content

## function **renderDynamic** \<T extends html_content_or_generator>(content: T): RenderPreset


No server side prerendering, loading all content over DATEX
 * @param content: HTML element or text content

## function **once** \<T extends html_generator>(generator: T): T



## function **provideValue** (value: unknown, options?: {type?: Datex.DATEX_FILE_TYPE,formatted?: boolean,})


serve a value as raw content (DX, DXB, JSON format)
 * @param value: any JS value (must be JSON compatible if JSON is used as the content type)
 * @param options: optional options:
type: Datex.FILE_TYPE (DX, DXB, JSON)
formatted: boolean if true, the DX/JSON is formatted with newlines/spaces
 * @return blob containing DATEX/JSON encoded value

## function **provideResponse** (content: ReadableStream | XMLHttpRequestBodyInit, type: mime_type, status: any, cookies?: Cookie[], headers: Record, cors: any)



## function **provideContent** (content: string | ArrayBuffer, type: mime_type, status?: number)


serve a string/ArrayBuffer with a specific mime type
 * @param content: 'file' content
 * @param type: mime type
 * @return content blob

## function **provideError** (message: string, status: any)


serve an errror with a status code and message
 * @param message: error message
 * @param status: http status code
 * @return content blob

## function **createSnapshot** \<T extends HTMLElement | DocumentFragment>(content: T, render_method: any): Promise


Render the current state of the element as HTML and cache for SSR
 * @param content: undefined
 * @param render_method: undefined
 * @return undefined

## function **resolveEntrypointRoute** \<T extends Entrypoint>(entrypoint: T | undefined, route?: Path.Route, context?: UIX.ContextGenerator | UIX.Context, only_return_static_content: any, return_first_routing_handler: any): Promise



## function **preloadElementOnBackend** (entrypoint: HTMLElement | DocumentFragment)



## function **refetchRoute** (route: Path.route_representation, entrypoint: Entrypoint, context?: UIX.Context)


gets the part of the route that is calculated without internal routing (RouteManager). 
Recalculate the current path from the inner Routing Handler if it exists
 * @param route: undefined
 * @param entrypoint: undefined
 * @param context: undefined
 * @return undefined

