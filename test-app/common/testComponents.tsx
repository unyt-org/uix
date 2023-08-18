import { UIX, unsafeHTML } from "uix/uix.ts";
import { Api, test } from "../backend/public.ts";
import { DropdownMenu } from "uix/components/DropdownMenu.tsx";
import { ValueInput } from "uix/components/ValueInput.tsx";
import { add, always, and } from "unyt_core/datex.ts";
import { sub, transform } from "https://dev.cdn.unyt.org/unyt_core/datex_short.ts";

/**
 * Put examples for all components in the testComponents object.
 * Every component can be displayed under the paths:
 *   /[key]/frontend 		(Fully rendered on the frontend)
 *   /[key]/backend+static 	(Fully server side rendered)
 *   /[key]/backend+dynamic (Loaded from the backend via DATEX)
 *   /[key]/backend+hydrated
 * 
 * (e.g. http://localhost:4200/textInput/backend+static )
 */

const Container = UIX.template(<div style={{display:"flex", gap:5, margin:5}}></div>)

const a = $$(0);
const b = $$(0);
const helloWorld = "Hello World";
setInterval(()=>a.val = Math.round(Math.random()*100), 1000);
setInterval(()=>b.val = Math.round(Math.random()*100), 2000);


const TemplateComp = UIX.template(<div style="color:red; font-size:2em"/>)
// allow children
const TemplateCompWithShadowRoot = UIX.template(
	<div style="color:green; font-size:2em" shadow-root>
		<input type="button" value="click me!" onclick={UIX.inDisplayContext(e => console.log("click",e.target))} onmousedown={e => console.log("mousedown",e.target)}/>
		custom layout before
		<slot/>
		custom layout after
	</div>
);

// same as TemplateCompWithShadowRoot, just with shadow root (template) explicitly declared
const TemplateCompWithShadowRootTemplate = UIX.template(
	<div style="color:blue; font-size:2em">
		<template shadowrootmode="open">
			custom layout before
			<slot/>
			custom layout after
		</template>
	</div>
);

const BlankTemplateComp = UIX.blankTemplate(({children}) => <div style="color:orange; font-size:2em">custom layout before{...children}custom layout after</div>)
const TemplateCompWithOptions = UIX.template<{a:number, b?:number}, never>(({a,b}) => <div>a={a}, b={b}</div>);


@UIX.template(<>
    <shadow-root>
        <h1 id="header">Header</h1>
        <section id="description"></section>
		<slot/>
    </shadow-root>
	predefined child
</>
)
class ClassComponent extends UIX.UIXComponent {
    @UIX.id declare header: HTMLHeadingElement
    @UIX.id declare description: HTMLElement

	protected override onConstruct(): void | Promise<void> {
		console.log("constructed")
	}

    override onCreate() {
		console.log("created")
		this.description.innerText = "New description ...";
    }
}

@UIX.template<{title:string}>(({title}) =>
	<article>
        <h1>{title}</h1>
        <section>Default section content</section>
    </article>
)
class ClassComponent2 extends UIX.ShadowDOMComponent<{title:string}> {
    override onCreate() {
        console.log("options",this.options)
    }
}

const CustomComponentWithSlots2 = UIX.template(<div>
    <shadow-root>
        Before children
        <slot/>
        After children
    </shadow-root>
    This child is appended to the slot element inside the shadow root
</div>)

const list = [
	{
		name: 'Example 1',
		url: 'https://unyt.org/1'
	},
	{
		name: 'Example 2',
		url: 'https://unyt.org/2'
	},
	{
		name: 'Example 3',
		url: 'https://unyt.org/3'
	}
]


const ListView = UIX.template(()=>{
	const index = $$ (0);
	const sculpture = index.transform(i => list[i]);

	return (<>
		<button onclick={()=>index.val++}>
			Next
		</button>
		<h2>
			<i>{sculpture.$.name} </i> 
			more: {sculpture.$.url}
		</h2>
		<h3>  
			({add(index, 1)} of {list.length})
		</h3>
	</>);	  
})



const ExampleImage = () => <img src="https://picsum.photos/536/354"/> as HTMLImageElement;
const exampleObject = $$({
	map: new Map<string, string>([['a','b']])
})


const TemplateWithOptions = UIX.template<{image:HTMLImageElement, x: number, map: Map<string, string>}>(({image, x, map})=> {
	console.log("TemplateWithOptions image", val(image), image)
	console.log("TemplateWithOptions x", val(x), x)
	console.log("TemplateWithOptions map", val(map), map)
	return (
		<div>
			X = {x}
			{image}
		</div>
	)
})

@UIX.style(SCSS`
	:host {
		background: green;
	}
`)
@TemplateWithOptions
export class CompontentWithOptions extends UIX.UIXComponent<{image?:HTMLImageElement, x: number, map: Map<string, string>, }> {
	protected override onCreate() {
		console.log("CompontentWithOptions image", this.options.image, this.options.$.image)
		console.log("CompontentWithOptions x", this.options.x, this.options.$.x)
		console.log("CompontentWithOptions map", this.options.map, this.options.$.map)
	}
}


export const testComponents = {

	textInput: 		<Container><div>&copy; <span>2023 unyt.org</span></div><ValueInput placeholder="text 1..."/></Container>,
	dropdownMenu: 	<Container><DropdownMenu/></Container>,

	templateAndComponent: UIX.lazy(() => 
		<Container>
			<TemplateWithOptions   x={a} map={exampleObject.$.map} image={<ExampleImage/> as HTMLImageElement}></TemplateWithOptions>
			<CompontentWithOptions x={a} map={exampleObject.$.map} image={<ExampleImage/> as HTMLImageElement}></CompontentWithOptions>
		</Container>
	),

	/** 
	 * Contexts demo:
	 * 
	 * Per default, event listeners are always called in the *original context*
	 * -> When the button is created on the backend and displayed in standalone mode 
	 *    on the frontend, the onclick handler is still called on the *backend*
	 * -> When the button is created and rendered on the frontend, the onclick
	 *    handler is called on the *frontend*
	 * 
 	 * By wrapping it with UIX.inDisplayContext(), the onmousedown handler is always called on
	 * the *frontend*, also in standalone mode
	*/
	contexts: 
		<button 
			onmousedown={UIX.inDisplayContext(() => console.log("mouse down"))} 
			onmouseup={Api.method1}
			onclick={async e => {
				console.log("clicked",e);
				const x = await test(10);
				console.log("res",x)
			}}
		>
			Click Me
		</button>,

	html: <div>
		{HTML `
			<h3>Header</h3>
			<p>
				<a href="/link">Link</a><br/>
				${1234}<br/>
				${"test content"}
			</p>
		`}
		{unsafeHTML('<div>Unsafe HTML<script type="text/javascript">alert(1)</script></div>')}
	</div>,

	list: <Container>
		<ListView></ListView>
	</Container>,

	datex:
		<Container>
			<div>{datex `<html/button> "click me"`}</div>
			<div>{always `${a} + ${b}`}</div>
			<div>val = #({a} * 100)</div>
			{HTML`<div>val2 = #(${a} * 100)</div>`}
			{HTML`<div id=#('id_${a}')>...</div>`}
		</Container>,

	// fixme: fragments not working correctly with JSdom and Text nodes
	fragment1 : <DocumentFragment>
		Child 1
		<i>Child 2</i>
		{123345}
	</DocumentFragment>,

	fragment2 : <>
		Child 1
		<i>Child 2</i>
		{123345}
	</>,

	templates: <>

		<CustomComponentWithSlots2>123</CustomComponentWithSlots2>
		<TemplateComp>Hello World</TemplateComp>
		<TemplateCompWithShadowRoot>Hello World Shadow Root</TemplateCompWithShadowRoot>
		<TemplateCompWithShadowRootTemplate>Hello World Shadow Root 2</TemplateCompWithShadowRootTemplate>
		<BlankTemplateComp>Hello World Blank</BlankTemplateComp>
		<TemplateCompWithOptions a={a} b={5}/>
		<ClassComponent><span>inner</span></ClassComponent>
		<ClassComponent2 title={a}>...here</ClassComponent2>

	</>,

	svg: 
		<svg 
			width="400"
			height="400">
			<circle
				cx={200}
				cy={200}
				r="100"
				fill="cyan"
				id="circle">
			</circle>
		</svg>
};