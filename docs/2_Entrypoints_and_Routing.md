# Entrypoints

In a UIX app, every UI view is provided via default exports from `entrypoint` files located at the root
of the backend or frontend directories.

There is a variety of values that can be exported from an entrypoint to be displayed in the browser client, including strings, HTML Elements, Blobs and [more](#entrypoint-values).

Example Entrypoints:
```typescript
// backend/entrypoint.ts
export default "Hello, this is a simple text displayed on a website and loaded from the backend entrypoint"
```
```tsx
// frontend/entrypoint.tsx
export default 
	<section>
		<h1>Title</h1>
		<p>Description...</p>
	</section>
```

# Entrypoint Configurations
## 1. Just a Frontend Entrypoint
If the backend entrypoint module does not have a default export or if there is no backend entrypoint,
the UI is generated directly on each frontend client from the frontend entrypoint.
This configuration is useful for complex web applications with user-specific UI and also when the UI content
should not be available on the backend.

## 2. Just a Backend Entrypoint
If there are no frontend entrypoint exports, the UI content is generated on the backend from the backend entrypoint and then sent to the frontend entrypoint.
There are multiple options for the transfer process:
 * `UIX.renderStatic`: The content is transferred to the frontend as static HTML (Server Side Rendering). The UIX Library does not need to be fully loaded on the frontend client, but lots of interactivity and data synchronisation features are not available.
 * `UIX.renderStaticWithoutJS`: Stricter version of `UIX.renderStatic`. No JavaScript is used on the Frontend, just static HTML and CSS.
 * `UIX.renderDynamic`: The content is transferred to the frontend via DATEX, allowing a full-featured UIX Library on the frontend.
 * `UIX.renderWithHydration`: Default transfer process. Content is first provided as static HTML, which can be immediately displayed on the frontend. After the UIX Library is loaded, the static content is gradually replaced with hydrated content loaded via DATEX.

## 3. Backend and Frontend Entrypoints
When entrypoint exports for both the frontend and the backend are available, they are automatically merged.
This Configuration normally only makes senses in combination with [Entrypoint Routes](#route-handlers).

# Entrypoint Values

## HTML Elements
HTML Elements are directly appended to the document body. The can be created with
normal DOM APIs (`document.createElement()`) or with JSX syntax:
```tsx
export default <div>Content</div> satisfies UIX.Entrypoint
```

Like other entrypoint values, HTML Elements are DATEX compatible and their content can be synchronized.
Keep in mind that the content is not updated when it is provided with `UIX.renderStatic`.
```tsx
const counter = $$(0);
setInterval(()=>counter.val++,1000);

export default <div>Count: {counter}</div> satisfies UIX.Entrypoint
```

## Strings
Strings are displayed as plain text (color and background color depends on the current App theme).

Example:
```typescript
export default "Hi World" satisfies UIX.Entrypoint
```

## Blobs
Blobs are directly displayed as files in the browser.

Example:
```typescript
export default datex.get('./image.png') satisfies UIX.Entrypoint
```

## Route Maps

Example:
```tsx
export default {
	'/home': <div>Home</div>,
	'/articles:' {
		'/first': 'First Article...',
		'/second': 'Second Article...'
	}
} satisfies UIX.Entrypoint
```

## Route Handlers
Example:
```tsx
export default (ctx: UIX.Context) => {
	return `You visited this page from ${ctx.request.address} and your language is ${ctx.language}`
} satisfies UIX.Entrypoint
```