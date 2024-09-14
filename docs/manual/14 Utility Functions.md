# Utility Functions

## The `redirect` function

It is recommended to use the `redirect` utility function when redirecting to a new page, instead of setting `window.location.href` directly.

The `redirect` function guarantees that all scheduled DATEX updates are sent before leaving the current page. This prevents inconsistencies for shared pointer values:

```ts
// safe navigation to "/home"
redirect("/home"); 
```

This is equivalent to
```ts
// wait until all scheduled DATEX updates are sent
await Datex.Runtime.synchronized; 
// navigate to "/home"
window.location.href = "/home"
```

The `redirect` function is available in the global scope per default, but can also be imported from `"uix/utils/window-apis.ts"`.

> [!NOTE]
> The `redirect` function can only be used on the frontend. If you want to redirect during backend routing, use the [`provideRedirect` function](./05%20Entrypoints%20and%20Routing#redirects)
