# Component Standalone Mode

UIX Components are rendered in standalone mode with `UIX.renderStatic`.
In this mode, static HTML is prerendered on the backend and sent to the frontend. 
The UIX library and other core libraries are not initialized.

In this mode, it is still possible to add interactivity and other TS functionality to components.

Component methods and properties that should be available in standalone mode have to be decorated with `@standalone`.

*Standalone support for component properties is still experimental*

```tsx

@Component
export class ButtonComponent extends BaseComponent {
	@standalone clickCounter = 0;
	@standalone @id count = <span>{this.options.text}</span>;
	@standalone @content button = <button onclick={()=>this.handleClick()}>I was clicked {this.count} times</button>;

	@standalone handleClick() {
		this.clickCounter++;
		this.count.innerText = this.clickCounter.toString();
	}
}
```

Some internal component lifecycle handlers are also supported in standalone mode.
The `standalone` property is `true` when to component is loaded in standalone mode.

```tsx
@Component
export class ButtonComponent extends BaseComponent {

	@standalone override onDisplay() {
		console.log("displayed in standalone mode: " + this.standalone)
	}

}
```

Keep in mind that reactive functionality is not supported in standalone mode.
If you want to use JSX, you need to explicitly import JSX:

```tsx
@Component
export class ButtonComponent extends BaseComponent {

	@standalone override async onDisplay() {
		await import("uix/jsx-runtime/jsx.ts");
		this.append(<div>Content</div>)
	}

}

```

If youe want to use any other UIX-specific functionality, you need to explicitly import UIX:

```tsx
// import in the module scope - not available in standalone mode
import { UIX } from "uix";

@Component
export class ButtonComponent extends BaseComponent {

	@standalone override async onDisplay() {
		// explict import in standalone mode
		const { UIX } = await import("uix");
		UIX.Theme.setMode("dark");
	}

}

```