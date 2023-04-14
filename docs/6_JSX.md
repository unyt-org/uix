# JSX

UIX supports JSX syntax for creating HTML Elements and UIX Components.

## Creating normal HTML Elements

All existing HTML Elements (e.g. `<div>`, `<p>`, `<img>`, ...) can be created with JSX. 
Supported attributes can also be used.

```tsx
const section = 
	<div id="section-1">
		<h1 style="font-weight:bold">Title</h1>
		<p>First Paragraph</p>
	</div>
```

### Special attributes values

Every attribute value can set to a DATEX pointer.
When the pointer value changes, the attribute is also updated.

Some attributes support special values. For example, all event listener attributes (`on[event]=...`) can take a callback function as a value.


```tsx
const btnDisabled = $$(false);

export default
	<div>
		<button disabled={btnDisabled}>Button</button>
		<button onclick={()=>btnDisabled.val=false}>Enable</button>
		<button onclick={()=>btnDisabled.val=true}>Disable</button>
	</div>
```

The `style` attribute also accepts an object with style declarations. The style properties can be pointer values that 
get dynamically updated.

```tsx
export default <div style={{color:'blue', padding:'10px'}}></div>
```

```tsx
// increase border width every 1s
const borderWidth = $$(0);
setInterval(()=>borderWidth.val++, 1000)

export default <div id="sd" style={{borderStyle:'solid', borderWidth}}>content</div>
```

## Creating Components

Component defined with functions or Component classes can also be created with JSX.
In addition to the default HTML Element attributes, all Component options can also be set
via JSX attributes:

```tsx
const comp = <UIX.Components.TextView style="color:green" text="text content"/>
```