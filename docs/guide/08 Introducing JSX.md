# Introducing JSX

**Remember Your First Website?** - Ah, the good ol' days! 
<br/>
Remember when you first ventured into web development? You proudly created your `index.html` file, slapped on an `index.css`, and thought, *"Wow, this is basically a masterpiece!"* Maybe you even threw in an `index.js` to get fancy with a button that didn't quite work, but hey, it changed something on the page!

```html title="index.html" icon="fa-file"
<!DOCTYPE html>
<html lang="en">
	<meta charset="UTF-8">
	<title>It's been a long time...</title>
	<link rel="stylesheet" href="./index.css">
	<body>
		<div>
			<h1>Hello world</h1>
			<input type="text" placeholder="My Text Input"/>
		</div>
	</body>
</html>
```

```css title="index.css" icon="fa-file"
body {
	/* Super fancy styles */
	background-color: red;
	color: green;
}

/* Styles for SaFarI */
body {
	-webkit-background-color: red;
}
```

Fast forward to today - introducing [JSX](https://facebook.github.io/jsx/) for [UIX](https://github.com/unyt-org/uix). With JSX, you can throw your old `.html` files into the digital attic. JSX takes all that nostalgia and cranks it up to 11 by letting you write HTML-like code directly in JavaScript / TypeScript!


If you plan to use JSX syntax inside of your UIX app, make sure to change your file's extension from `.ts` to `.tsx`.

All DOM elements (e.g. `<div>`, `<p>`, `<img>`, `<svg>`, ...) can now be used within your TypeScript code as it was HTML:

```tsx
// That's magic, isn't it?
const myDiv = <div>Hello world</div>;
```

Alright, let's see an example in how to render something in our `entrypoint.tsx` that we can acutally see in the browser. For that we can just set our default export to some JSX element:

```tsx title="entrypoint.tsx" icon="fa-file"
export default <div>
	<h1>Hello world</h1>
	<input type="text" placeholder="My Text Input"/>
</div>;
```