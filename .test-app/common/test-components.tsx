import { Api, test } from "../backend/public.ts";

import { add, always, and, map, not, select } from "datex-core-legacy/functions.ts";
import { blankTemplate, style, template } from "uix/html/anonymous-components.ts";
import { HTTPError } from "uix/html/http-error.ts";
import { HTTPStatus } from "uix/html/http-status.ts";
import { inDisplayContext } from "../../utils/datex-over-http.ts";
import { UIXComponent } from "uix/components/UIXComponent.ts";
import { lazy, provideError } from "uix/html/entrypoint-providers.tsx";
import { unsafeHTML } from "uix/uix_short.ts";
import { enableOverlayScrollbars } from "uix/utils/overlay-scrollbars.ts";

/**
 * Put examples for all components in the testComponents object.
 * Every component can be displayed under the paths:
 *   /[key]/frontend 		(Fully rendered on the frontend)
 *   /[key]/backend+static 	(Fully server side rendered)
 *   /[key]/backend+dynamic (Loaded from the backend via DATEX)
 *   /[key]/backend+hydrated
 * 
 * (e.g. http://localhost:4201/textInput/backend+static )
 */

const Container = template(<div style={{display:"flex", gap:5, margin:5}}></div>)

const a = $$(0);
const b = $$(0);

const toggle1 = $$(true);

setInterval(()=>a.val = Math.round(Math.random()*100), 1000);
setInterval(()=>b.val = Math.round(Math.random()*100), 2000);


const TemplateComp = template(<div style="color:red; font-size:2em"/>)
// allow children
const TemplateCompWithShadowRoot = template(
	<div style="color:green; font-size:2em" shadow-root>
		<input type="button" value="click me!" onclick={inDisplayContext(e => console.log("click",e.target))} onmousedown={e => console.log("mousedown",e.target)}/>
		custom layout before
		<slot/>
		custom layout after
	</div>
);

// same as TemplateCompWithShadowRoot, just with shadow root (template) explicitly declared
const TemplateCompWithShadowRootTemplate = template(
	<div style="color:blue; font-size:2em">
		<template shadowrootmode="open">
			custom layout before
			<slot/>
			custom layout after
		</template>
	</div>
);

const BlankTemplateComp = blankTemplate(({children}) => <div style="color:orange; font-size:2em">custom layout before{...children}custom layout after</div>)
const TemplateCompWithOptions = template<{a:number, b?:number}, never>(({a,b}) => <div>a={a}, b={b}</div>);

@template(<>
    <shadow-root>
        <h1 id="header">Header</h1>
        <section id="description"></section>
		<slot/>
    </shadow-root>
	predefined child
</>
)
class ClassComponent extends UIXComponent {
    @id declare header: HTMLHeadingElement
    @id declare description: HTMLElement

	protected override onConstruct(): void | Promise<void> {
		console.log("constructed")
	}

    override onCreate() {
		console.log("created")
		this.description.innerText = "New description ...";
    }
}

@template<{title:string}>(({title}) =>
	<article>
        <h1>{title}</h1>
        <section>Default section content</section>
    </article>
)
class ClassComponent2 extends UIXComponent<{title:string}> {
    override onCreate() {
        console.log("options",this.options)
    }
}


// shadow root + slot
const CustomComponentWithSlots1 = template(<div>
	1
    <shadow-root>
		<slot name="title" style="font-weight:bold"/>
        Before children
        <slot/>
        After children
    </shadow-root>
    This child is appended to the slot element inside the shadow root
</div>)

// alternative shadow root + slot
const CustomComponentWithSlots2 = template(<div>
	2
    <ShadowRoot>
		<slot name="title" style="font-weight:bold"/>
        Before children
        <slot/>
        After children
    </ShadowRoot>
    This child is appended to the slot element inside the shadow root
</div>)

// light root + slot
const CustomComponentWithSlots3 = template(<div>
	3
    <light-root>
		<slot name="title" style="font-weight:bold"/>
        Before children
        <slot/>
        After children
    </light-root>
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

let count = 2;
let deleteCounter = 0;
const entryList = $$([
	$$({
		name: 'Example 1',
		description: 'The first example',
		color: 'green'
	})
])

setInterval(()=>{
	entryList.push($$({
		name: `The ${count++}. example`,
		description: "Some description text",
		color: 'green'
	}))
}, 2000)

setInterval(()=>{
	// entryList.splice(deleteCounter++, 1);
	delete entryList[deleteCounter++];
}, 3500)


const ListView = template(()=>{
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


const likesCheese = $$(true);


const ExampleImage = () => <img src="https://picsum.photos/536/354"/> as HTMLImageElement;
const exampleObject = $$({
	map: new Map<string, string>([['a','b']])
})


const TemplateWithOptions = template<{image:HTMLImageElement, x: number, map: Map<string, string>}>(({image, x, map})=> {
	console.debug("TemplateWithOptions image", val(image), image)
	console.debug("TemplateWithOptions x", val(x), x)
	console.debug("TemplateWithOptions map", val(map), map)
	return (
		<div>
			X = {x}
			{image}
		</div>
	)
})

@style(SCSS`
	:host {
		background: green;
	}
`)
@TemplateWithOptions
export class ComponentWithOptions extends UIXComponent<{image?:HTMLImageElement, x: number, map: Map<string, string>, }> {
	protected override onCreate() {
		console.debug("CompontentWithOptions image", this.options.image, this.options.$.image)
		console.debug("ComponentWithOptions x", this.options.x, this.options.$.x)
		console.debug("ComponentWithOptions map", this.options.map, this.options.$.map)
	}
}

@style("./style1.css")

@style(SCSS`
	div {
		background: green;
		color: #eee;

		& h1 {
			color: white;
		}
	}
`)

@style(SCSS`
	* {
		font-family: sans-serif;
	}
`)
@template(
	<div>
		<h1>Title</h1>
		Lorem Ispum blalblablababl...
	</div>
)
export class ComponentWithStyle extends UIXComponent {

	// TODO: source maps for @display
	@display override onDisplay() {
		console.log("displaying ComponentWithStyle")
	}
}




export const testComponents = {

	templateAndComponent: lazy(() => 
		<Container>
			<TemplateWithOptions   x={a} map={exampleObject.$.map} image={<ExampleImage/> as HTMLImageElement}></TemplateWithOptions>
			<ComponentWithOptions x={a} map={exampleObject.$.map} image={<ExampleImage/> as HTMLImageElement}></ComponentWithOptions>
		</Container>
	),

	style: lazy(() => <ComponentWithStyle/>),

	redirect: new URL("https://google.com"),

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
			onmousedown={inDisplayContext(() => console.log("mouse down"))} 
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

	select: <div>
		<div class="preference">
			<label for="cheese" data-likes-cheese={likesCheese}>Do you like cheese?</label>
			<input type="checkbox" id="cheese" checked={likesCheese}/>
		</div>
	</div>,

	// dynamically map a live ref array to a DOM element list
	dynamicList: lazy(() => <div>
		<h2>My List ({always(()=>entryList.reduce((p,v)=>(v===undefined ? 0 : 1)+p, 0))} entries)</h2>
		<ul>
			{map(entryList, entry =>
				 <li style={{color:entry.$.color}} onclick={()=>entry.color="blue"}>{entry.name}</li>
			)}
		</ul>
		<button onclick={()=>entryList.push($$({name:'New Item ' + new Date(), description: "", color: "orange"}))}>Add Entry</button>
	</div>),

	// same as dynamicList, but using always and the built-in array map method (less efficient)
	dynamicList2: lazy(() => <div>
		<h2>My List ({always(()=>entryList.reduce((p,v)=>(v===undefined ? 0 : 1)+p, 0))} entries)</h2>
		<ul>
			{always(() => entryList.map(entry =>
				<li style={{color:entry.$.color}} onclick={()=>entry.color="blue"}>{entry.name}</li>
			))}
		</ul>
		<button onclick={()=>entryList.push($$({name:'New Item ' + new Date(), description: "", color: "orange"}))}>Add Entry</button>
	</div>),

	paths: <ul>
		<li>Path relative to module: <a href="./assets/example.txt">Open</a></li>
		<li>Path relative to current route on client: <a href:route="../routeExample/frontend">Open</a></li>
	</ul>,

	counterElement: (await import('./modules/counterElement.eternal.tsx')).default,
	// counterComponent: await import('./modules/counterComponent.eternal.tsx'),

	routeExample: <div>This is a route</div>,

	overlayScrollbars: () => 
		enableOverlayScrollbars(<div style="margin:40px;box-sizing:border-box;background:#eee; height: 200px;overflow:scroll">
			Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque 
			laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi 
			architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas 
			sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione 
			voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit 
			amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut 
			labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum
			exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?
			 Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae 
			 consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.
			 Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque 
			laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi 
			architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas 
			sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione 
			voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit 
			amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut 
			labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum
			exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur?
			 Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae 
			 consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur
			 <div style="background:cornflowerblue;width:1000px;height:30px;">Wide Div</div>
		</div>),

	// shows error alert with stack trace
	errorExample: () => {
		throw new Error("This is an error")
	},

	// shows error alert with stack trace
	errorExample2: () => {
		throw new HTTPError(HTTPStatus.INTERNAL_SERVER_ERROR)
	},

	// shows error alert with stack trace
	errorExample3: () => {
		return new HTTPError(500, "Error Example")
	},

	// renders empty page, HTTP status code is 403
	errorExample4: () => {
		return HTTPStatus.FORBIDDEN
	},

	// renders string, HTTP status code is 500
	errorExample5: () => {
		throw "An error result"
	},

	// shows error alert with stack trace
	errorExample6: () => {
		return new SyntaxError("There is an error in you syntax")
	},

	// shows error alert
	errorExample7: () => {
		return provideError("My custom error", "Custom error message")
	},

	rawResponse: () => {
		return new Response("Hello World!", {headers: {"Content-Type": "text/css"}})
	},

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
		<CustomComponentWithSlots1><div slot="title">X1</div>x1</CustomComponentWithSlots1>
		<CustomComponentWithSlots2><div slot="title">X2</div>x2</CustomComponentWithSlots2>
		<CustomComponentWithSlots3><div slot="title">X3</div>x3</CustomComponentWithSlots3>
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