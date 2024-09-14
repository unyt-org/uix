## function **bindToOrigin** \<F extends unknown - todo>(fn: F, context?: any, name?: string, forceDatex: any): F extends unknown - todo ? unknown - todo : never


Wraps a function so that it is always called in the original context.

In standalone mode, the function is always called on the backend endpoint.

This is the default behavior when setting event listeners in JSX.

- uses datex-over-http when DATEX is not available
- parameters must be json compatible
 * @param fn: undefined

## function **getValueInitializer** (value: any, forceDatex: any): string


Wraps a value so that it is always loaded from the original context.

- uses datex-over-http when DATEX is not available
 * @param fn: undefined

## function **inDisplayContext** \<F extends unknown - todo>(fn: F): F


Force a function (e.g. event handler) to be run on the frontend.

The function will also be called on the frontend in standalone mode.
Most UIX Apis and the outer module context are not available inside the wrapped function.

This is the counterpart to UIX.bindToOrigin, which always ensures that
the module context is available inside the wrapped function.

