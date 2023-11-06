# Components

## Template components
The easiest way to define components in UIX is using templates.
With anonymous component templates, you can still get reactive behaviour and saved states, but you don't get any advanced component features like
lifecycle handlers and utility methods.
Anonymous components are built on top of existing DOM API features (shadow roots, slots).

To define a new template, call the `template` function and pass in an element value (JSX definition) or a generator function returning an element (JSX):

```tsx
import { template } from "uix/html/template.ts";

// define templates:
const CustomComponent = template(<div class='class1'></div>)
const CustomComponent2 = template<{customAttr:number}>(({customAttr}) => <div class='class2'><b>the customAttr is {customAttr}</b></div>)

// create elements:
const comp1 = <CustomComponent id='c1'/> // returns: <div class='class1' id='c1'></div>
const comp2 = <CustomComponent id='c2' customAttr={42}/> // returns: <div class='class2' id='c2'><b>the customAttr is 42</b></div>
```

### Child elements

Default element attributes (e.g. `id`, `style`, ...) are assigned to the root element after it is created.
Children defined in JSX are also appended to the root element per default:

```tsx
// define template:
const CustomComponent = template(<div class='class1'></div>)

// create element:
const comp3 = <CustomComponent id='c1'>
    <div>Child 1</div>
    {"Child 2"}
</CustomComponent>;

/* returns:
<div class='class1' id='c1'>
    <div>Child 1</div>
    Child 2
</div>
*/
```

### Advanced example

```tsx
import { template } from "uix/html/template.ts";

// define component template:
const MyComponent = template<{background: 'red'|'green', countstart: number}>(({background, countstart}) => {
    // create a counter pointer and increment every second
    const counter = $$(countstart);
    setInterval(() => counter.val++, 1000);

    // return component content
    return <div style={{background}}>
                Count: {counter}
           </div>
});

// create element:
export default
    <MyComponent background="green" countstart={42}>
        <div>child 1</div>
        <div>child 2</div>
    </MyComponent>
```

### Using blankTemplate / function components

For some use cases, it may be useful to access all attributes and the children set in JSX when creating an anonymous component.

The `blankTemplate` function allows you to create an element with complete control over attributes and children.
In contrast to `template`, children defined in JSX are not automatically appended to the root element of the template,
and HTML Attributes defined in JSX are also not automatically set for the root element.

All attributes and the children are available in the props argument of the generator function.
```tsx
import { blankTemplate } from "uix/html/template.ts";

// define:
const CustomComponent = blankTemplate<{color:string}>(({color, style, id, children}) => <div id={id} style={style}><h1>Header</h1>{...children}</div>)

// create:
const comp = (
<CustomComponent id="c1">
     <div>first child</div>
     <div>second child</div>
</CustomComponent>
)
```

This behaviour is more similar to other JSX frameworks. You can also just use a normal function instead of `blankTemplate` (the `blankTemplate` is just a wrapper around a component function with some additional type features).

Keep in mind that UIX always returns the `children` property as an array, even if just a single child was provided in JSX.
```tsx
// define:
function CustomFunctionComponent({color, id, children}: {id:string, children:HTMLElement[], color:string}) {
    return <div id={id} style={{color}}>
        {...children}
    </div>
}

// create:
const comp = (
<CustomFunctionComponent id="c1" color="blue">
     <div>first child</div>
     <div>second child</div>
</CustomFunctionComponent>
```


## Creating custom component classes

You can create custom UIX components by extending `Component` or another UIX Component class and register it by decorating the class with `@template`.


```typescript
import { template } from "uix/html/template.ts";
import { Component } from "uix/components/Component.ts";

// register the component and set default options
@template()
class MyCustomComponent extends Component {

    @content helloText = "Hello from my custom component"

}
```

## Creating component classes based on templates

Templates defined with `template` can also be used as a base layout for component classes - 
just use the template returned from `template` as a class decorator.

*With the `@id` decorator, component properties can be bound to the element inside the component which has
an id that equals the property name.
When the property is overriden, the element with the matching id is also replaced with the new property.*

```tsx
// using a static template
@template(
    <article>
        <h1 id="header">Header</h1>
        <section id="description"></section>
    </article>
)
class MyCustomComponent extends Component {
    @id declare header: HTMLHeadingElement
    @id declare description: HTMLElement

    override onCreate() {
        this.description.innerText = "Some description text..."
    }
}
```
```tsx
// using a template generator
@template<{title:string}>(({title}) =>
    <article>
        <h1>{title}</h1>
        <section>Default section content</section>
    </article>
)
class MyCustomComponent extends Component<{title:string, additionalOption:number}> {
    override onCreate() {
        console.log("options", this.options.title, this.options.additionalOption)
    }
}
```
```tsx
// using a pre-defined template
const CoolDiv = template(<div>cool</div>);

@CoolDiv
class MyCustomComponent extends Component<{title:string}> {
    onCreate() {}
}
```


## Component children

Children can be added to components like to any HTML Element:
```tsx
// add children with DOM APIs
const comp1 = new CustomComponent();
comp1.append(<div>content 1</div>)
comp1.append("text content")

// add children with JSX
const comp2 = 
    <CustomComponent>
        <div>child 1</div>
        <div>child 2</div>
    </CustomComponent>
```


Component children are part of the component state and are restored when the component is recreated.

## Defining the internal component layout

Internal component content can be added and modified at any stage of the component lifecycle.
For most use cases, it makes sense to initialize the content when the component is created (using `@template`).

Another option are `@layout` decorators that can be added to properties and bind the property value to the component dom automatically. 

```tsx
@template()
class ParentComponent extends Component {
    // add layout content to the component dom
    // + elements automatically get assigned an id
    @layout componentTitle = <div>Component Title</div>
    @layout description = <div>...</div>

    override onCreateLayout() {
        // similar effect as using @layout, but no automatic id binding
        this.content_container.append(<div>More Layout</div>)
    }
}

// create a new ParentComponent with children
export default 
    <ParentComponent>
        <div>Child 1</div>
        <div>Child 2</div>
    </ParentComponent>
```

### The `@id` decorator
To access elements defined in the template layout consider assigning an unique id attribute to the corresponding elements:

```tsx
@template(()=>{
    <div id="parent">
         <h1>Hello</h1>
         <input id="myInput" value="Hello UIX" type="text"/>
    </div>
})
class MyApp extends Component {
    // declare id explicitly if property name does not match id
    @id("parent") declare myParent: HTMLDivElement;

    // declare myInput automaticially since myInput property matches id
    @id declare myInput: HTMLInputElement;
}
```

### The `@child` decorator

Children can also be directly bound to a component with the `@child` decorator:
```tsx
@template()
class ParentComponent extends Component {
    // statically defined children
    @child child1 = <div>Child 1</div>
    @child child2 = <div>Child 2</div>
}

// initialize component with additional children
const parent = 
    <ParentComponent>
        <div>Child 3</div>
    </ParentComponent>
```

## Component lifecycle


```typescript
@Component class CustomComponent extends UIX.BaseComponent {

    // called when component is constructed
    onConstruct() {}

    // called after component is constructed or restored
    onInit() {}

    // called once before onAnchor
    onCreate() {}

    // called every time the component is added to a new parent in the DOM
    onAnchor() {}

    // called after onAnchor when the component is displayed in a browser context
    onDisplay() {}

}

```

## Styling

See [Styles and Themes](./11%20Style%20and%20Themes.md)
