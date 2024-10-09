# Components
Components encapsulate distinct pieces of UI functionality, promoting reusability, modularity, and ease of maintenance.


## Anonymous component templates
The easiest way to define components in UIX is to use `templates`.

With anonymous component templates, you can still get behavior and stored states, but you don't get any advanced component features like
lifecycle handlers and utility methods.
Anonymous components are built on top of existing DOM API features (shadow roots, slots).

To define a new template, call the `template` function and pass in an element value (JSX definition) or a generator function that returns an element (JSX):

```tsx title="frontend/entrypoint.tsx" icon="fa-file"
import { template } from "uix/html/template.ts";

// Define the template
const SimpleComponent = template(<div class="simple"/>);

// Instantiate the component
export default <SimpleComponent id="c1"/>;
```

will render as:
```html
<div class="simple" id="c1"/>
```

The `template` method can also take properties (user defined attributes):

```tsx
const ComplexComponent = template<{customAttr: number}>(({customAttr}) =>
    <div class="complex">
        <b>Answer is: {customAttr}</b>
    </div>
);

<ComplexComponent id="c2" customAttr={42}/>
```

will render as:
```html
<div class="complex" id="c2">
    <b>Answer is: 42</b>
</div>
```

### Child elements

Default element attributes (e.g. `id` and `style`) are assigned to the root element after it is created.
Children defined in JSX are also appended to the root element by default:

```tsx
const CustomComponent = template(<div class="class1"/>);

<CustomComponent id="c1">
    <div>Child 1</div>
    {'Child 2'}
</CustomComponent>
```

will be rendered as:
```html
<div class="class1" id="c1">
    <div>Child 1</div>
    Child 2
</div>
```

### Advanced example

```tsx
const MyComponent = template<{
    background: 'red' | 'green',
    countstart: number
}>(({background, countstart}) => {
    // create a counter pointer
    const counter = $(countstart);

    // Increment the counter every second
    setInterval(() => counter.val++, 1000);

    // return component content
    return <div style={{background}}>
        Count: {counter}
    </div>;
});

<MyComponent background="green" countstart={42}>
    <div>Child 1</div>
    <div>Child 2</div>
</MyComponent>
```

### Using blankTemplate / function components

For some use cases, it may be useful to access all attributes and the children set in JSX when creating an anonymous component.

The `blankTemplate` function allows you to create an element with complete control over attributes and children.
Unlike `template`, children defined in JSX are not automatically appended to the root element of the template, and HTML attributes defined in JSX are not automatically set for the root element.

All attributes and children are available in the props argument of the generator function.
```tsx
import { blankTemplate } from "uix/html/template.ts";

const CustomComponent = blankTemplate<{
    color:string
}>(({color, style, id, children}) => 
    <div id={id} style={style}>
        <h1 style={{color}}>Header</h1>
        {...children}
    </div>
);

<CustomComponent id="c1" color="blue">
    <div>First child</div>
    <div>Second child</div>
</CustomComponent>
```

This behavior is more similar to other JSX frameworks. You can also just use a normal function instead of `blankTemplate` (the `blankTemplate` is just a wrapper around a component function with some additional type features).

Keep in mind that UIX always returns the `children` property as an array, even if just a single child was provided in JSX.
```tsx
function CustomFunctionComponent({color, id, children}: {id:string, children:JSX.Element[], color:string}) {
    return <div id={id} style={{color}}>
        {...children}
    </div>;
};

<CustomFunctionComponent id="c1" color="blue">
     <div>First child</div>
     <div>Second child</div>
</CustomFunctionComponent>
```


## Custom class components

You can create custom UIX components by extending the `Component` class and registering it by decorating the class with `@template`.


```typescript
import { template } from "uix/html/template.ts";
import { Component } from "uix/components/Component.ts";

// register the component and set default options
@template()
class MyCustomComponent extends Component {
    @content helloText = 'Hello from my custom component';
}
```

## Class template components

Templates defined with `template` can also be used as a base layout for component classes - just use the template returned by `template` as a class decorator.

The simplest form is to use a static template definition by passing JSX directly to the `template` decorator:
```tsx
@template(
    <article>
        <h1 id="header">UIX</h1>
        <section id="description">Hello, UIX!</section>
    </article>
)
class MyCustomComponent extends Component {
    public sayHello() {
        // Do something
    }
}
```

To allow for attributes to be handled in the template definition, it is recommended to use a template generator by passing a callback function that returns JSX to the template decorator:

```tsx
@template(({title}) =>
    <article>
        <h1>{title}</h1>
        <section>Default section content</section>
    </article>
)
class MyCustomComponent extends Component<{
    title: string,
    additionalOption: number
}> {
    public sayHello() {
        // The passed parameters are available in 'properties'
        console.log(this.properties.title, this.properties.additionalOption);
    }
}

<MyCustomComponent title="Hello, UIX!" additionalOption={42}>
```

Custom attributes defined for your components *(such as `title` and `additionalOption` in above example)* can be accessed via the `properties` field. This acts as a type-safe accessor similar to [`props` in React](https://react.dev/learn/passing-props-to-a-component).


It is possible to use predefined templates to abstract behaviour:

```tsx
const CoolDiv = template(<div>What is cooler than being cool?</div>);

@CoolDiv
class MyCustomComponent extends Component<{title:string}> {
    // ...
}
```

### OpenGraph meta tags
UIX allows you to add [OpenGraph](https://ogp.me) meta tags to your custom class components to improve SEO and social media sharing. Meta tags such as title, description, and preview images are auto generated when rendering the component on the backend. The tags will be picked up by platforms like Twitter, Instagram, etc., automatically.

To apply custom OpenGraph metadata, create a instance of the `OpenGraphInformation` class and add override the `[OPEN_GRAPH]` symbol of the component.

```ts
class OpenGraphInformation {
    constructor(
        openGraphData: {
            title?: string;
            description?: string;
        },
        openGraphOptions?: {
            getImageURL: () => string;
        }
    );
}
```
Here’s an example of how to implement it within a custom class component:


```tsx
import { OPEN_GRAPH, OpenGraphInformation } from "uix/base/open-graph.ts";
import { Component } from "uix/components/Component.ts";

class MyCustomComponent extends Component {
    override [OPEN_GRAPH] = new OpenGraphInformation({
        title: "Hello, UIX!",
        description: "This is the description of my UIX page."
    }, {
        getImageURL() {
            return "https://example.com/preview.png";
        }
    });
}
```

<!-- 
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
``` -->

### The `@id` decorator
With the `@id` decorator, component properties can be bound to the element inside the component that has an [`id`](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/id) attribute set that matches the properties name.

To access elements defined in the template layout consider assigning an unique id attribute to the corresponding elements:

```tsx
@template(
    <div id="parent">
        <h1>Hello</h1>
        <input id="myInput" value="Hello, UIX!" type="text"/>
    </div>
)
class MyApp extends Component {
    // declare myInput automaticially since myInput property matches id
    @id myInput!: HTMLInputElement;

    // declare id explicitly if property name does not match id
    @id('parent') myParent!: HTMLDivElement;
}
```
Note that, when the property is overridden, the element with the matching id is also replaced with the new property. 

<!-- 
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
``` -->

### Component lifecycle
Class components extending the `Component` class will expose methods to handle the components lifecyle. 

```typescript
@Component
class CustomComponent extends Component {
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

It is recommended to use the `onDisplay` method to run user code that should be executed when the component has has finished rendering in the browser.

## Children handling

Children can be added to components just like any other HTML element:
```tsx
// add children with DOM APIs
const comp1 = new CustomComponent();
comp1.append(<div>content 1</div>);
comp1.append("text content");

// add children with JSX
const comp2 = 
    <CustomComponent>
        <div>Child 1</div>
        <div>Child 2</div>
    </CustomComponent>;
```

Component children are part of the component state and are restored when the component is recreated.

## Component styling

See [Styles and Themes](./12%20Style%20and%20Themes.md).