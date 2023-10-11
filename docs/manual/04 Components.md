# Components

## Anonymous components (templates)
The easiest way to define components in UIX is using templates.
With anonymous component templates, you can still get reactive behaviour and saved states, but you don't get any advanced component features like
lifecycle handlers and utility methods.
Anonymous components are built on top of existing DOM API features (shadow roots, slots).

To define a new template, call the `UIX.template` function and pass in an element value (JSX definition) or a generator function returning an element (JSX):

```tsx
// define templates:
const CustomComponent = UIX.template(<div class='class1'></div>)
const CustomComponent2 = UIX.template<{customAttr:number}>(({customAttr}) => <div class='class2'><b>the customAttr is {customAttr}</b></div>)

// create elements:
const comp1 = <CustomComponent id='c1'/> // returns: <div class='class1' id='c1'></div>
const comp2 = <CustomComponent id='c2' customAttr={42}/> // returns: <div class='class2' id='c2'><b>the customAttr is 42</b></div>
```

### Child elements

Default element attributes (e.g. `id`, `style`, ...) are assigned to the root element after it is created.
Children defined in JSX are also appended to the root element per default:

```tsx
// define template:
const CustomComponent = UIX.template(<div class='class1'></div>)

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

### Using shadow roots

To get more control over the location of child elements, shadow roots and slots can be used.
To add a shadow root to the root element add a `<shadow-root>` element as the first child of the outer element.
Alternativly, you can add a `shadow-root` attribute to the outer element. In this case, they child elements of the outer element are
all appended to the shadow root.

```tsx
// define template:
const CustomComponentWithSlots = UIX.template(<div shadow-root>
    Before children
    <slot/>
    After children
</div>)

// alternative template definition:
const CustomComponentWithSlots2 = UIX.template(<div>
    <shadow-root>
        Before children
        <slot/>
        After children
    </shadow-root>
    This child is appended to the slot element inside the shadow root
</div>)

// create element:
const comp3 = <CustomComponentWithSlots id='c1'>
    <div>Child 1</div>
    {"Child 2"}
</CustomComponentWithSlots>;

/* returns:
<div id='c1'>
    #shadow-root
        Before children
        <slot>
            <div>Child 1</div>
            Child 2
        </slot>
        After children
</div>
*/
```

### Advanced example

```tsx
// define component template:
const MyComponent = UIX.template<{background: 'red'|'green', countstart: number}>(({background, countstart}) => {
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

### Using UIX.blankTemplate / function components

For some use cases, it might make be useful to access all attributes and the children set in JSX when creating an anonymous component.

The UIX.blankTemplate function allows you to create an element with complete control over attributes and children.
In contrast to UIX.template, children defined in JSX are not automatically appended to the root element of the template,
and HTML Attributes defined in JSX are also not automatically set for the root element.

All attributes and the children are available in the props argument of the generator function.
```tsx
// define:
const CustomComponent = UIX.blankTemplate<{color:string}>(({color, style, id, children}) => <div id={id} style={style}><h1>Header</h1>{...children}</div>)

// create:
const comp = (
<CustomComponent id="c1">
     <div>first child</div>
     <div>second child</div>
</CustomComponent>
)
```

This behaviour is more similar to other JSX frameworks. You can also just use a normal function instead of `UIX.blankTemplate` (the `UIX.blankTemplate` is just a wrapper around a component function with some additional type features).

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

You can create custom UIX components by extending `UIX.BaseComponent` or another UIX Component class and register it by decorating the class with `@Component`.


```typescript
// register the component and set default options
@Component
class MyCustomComponent extends UIX.BaseComponent {

    @content helloText = "Hello from my custom component"

}
```

## Creating component classes based on templates

Templates defined with `UIX.template` can also be used as a base layout for component classes - 
just use the template returned from `UIX.template` as a class decorator.

*With the `@UIX.id` decorator, component properties can be bound to the element inside the component which has
an id that equals the property name.
When the property is overriden, the element with the matching id is also replaced with the new property.*

```tsx
// using a static template
@UIX.template(
    <article>
        <h1 id="header">Header</h1>
        <section id="description"></section>
    </article>
)
class MyCustomComponent extends UIX.BaseComponent {
    @UIX.id declare header: HTMLHeadingElement
    @UIX.id declare description: HTMLElement

    override onCreate() {
        this.description.innerText = "Some description text..."
    }
}
```
```tsx
// using a template generator
@UIX.template<{title:string}>(({title}) =>
    <article>
        <h1>{title}</h1>
        <section>Default section content</section>
    </article>
)
class MyCustomComponent extends UIX.BaseComponent<{title:string, additionalOption:number}> {
    override onCreate() {
        console.log("options", this.options.title, this.options.additionalOption)
    }
}
```
```tsx
// using a pre-defined template
const CoolDiv = UIX.template(<div>cool</div>);

@CoolDiv
class MyCustomComponent extends UIX.BaseComponent<{title:string}> {
    onCreate() {}
}
```


## Defining custom options 

The `UIX.BaseComponent.Options` interface can also be extended for custom Component options. 
The interface and any related classes or variables should be put in the namespace of the component class:


```typescript
// component namespace
namespace MyCustomComponent {
    export interface Options extends UIX.BaseComponent.Options {
        strings:string[]
    }
}

// register the component and set default options
@Component<MyCustomComponent.Options>({
    border_radius: 20,
    strings: ['a string', 'morestring']
})
class MyCustomComponent extends UIX.BaseComponent<MyCustomComponent.Options> {

    @content helloText = "Hello from my custom component"

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

Children can also be directly bound to a component with the `@child` decorator:
```tsx
@Component
class ParentComponent extends UIX.BaseComponent {
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

Component children are part of the component state and are restored when the component is recreated.


## Internal component layout (Shadow DOM with UIX.ShadowDOMComponent)

Components extending `UIX.ShadowDOMComponent` have the following structure:
```html
<uix-component>

    <!--Shadow DOM-->
    #shadow-root
        <!--internal layout-->
        <div>Internal Layout</div>
        <!--content slot-->
        <slot id="content">
            <!--virtual children-->
            <div>child 1</div>
            <div>child 2</div>
        <slot>

    <!--children-->
    <div>child 1</div>
    <div>child 2</div>

</uix-component>
```
### Defining the internal component layout

Besides the children, additional content can be added to a component.
This content is part of the internal component layout hidden in the Shadow DOM and is not saved in the component state.

Internal component content can be added and modified at any stage of the component lifecycle.
For most use cases, it makes sense to initialize the content when the component is created (in the `onInit` or `onCreateLayout` handler or by binding properties with `@layout`):

```tsx
@Component
class ParentComponent extends UIX.ShadowDOMComponent {
    // add layout content to the shadow dom
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
### The `@content` decorator

The `@content` decorator adds a child to the `slot#content` element and visually has the same effect as using the `@child` decorator.
But in contrast to the `@child` decorator, the `@content` does not add the child to the saved component state - it is still regarded as an internal layout. 

Also, it is not possible to use the `@content` decorator *and* append children to the component (e.g. by using `append()` or the `@child` decorator). In this case, all children defined with the `@content` decorator will no longer be displayed.

```tsx
@Component
class ParentComponent extends UIX.ShadowDOMComponent {
    @layout componentTitle = <div>Component Title</div>
    @content customContent = <div>Content</div>
}

export default <ParentComponent/>
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

## Component styles

### External style files

To apply css styles to a component in a module `my_component.ts`, you can create a CSS or SCSS file next to the module file, called `my_component.css` or `my_component.scss`. 

The styles declared in this file are automatically adopted for all instances of the component and are not exposed
to other components.

You can use the `:host` selector to access the component root element (also when not using a shadow dom).

For general global styles, you can add an `entrypoint.(s)css` file next to the `entrypoint.ts` file.

### Inline styles

Another way to add css rules to a component is to use inline styles with the `@style` decorator:

```ts
@style(SCSS `
  div {
    background: red;
    font-size: 2em;
  }
`)
@template(...)
class MyComponent extends UIXComponent {
   ...
}
```

The `@style` decorator accepts a `CSSStylesheet` as a parameter.
The best way to create this stylesheet is using the `SCSS` template function.

#### The `SCSS` template function

The `SCSS` function creates a `CSSStylesheet` from any valid (s)css string (@import directives are not allowed).
Additionally, it supports reactive properties:

```ts
const fontSize: Datex.Ref<string> = $$("10px")
const stylesheet: CSSStylesheet = SCSS `
  h1.big {
    font-size: ${fontSize};
    color: ${it => it.myColor};
  }
`
fontSize.val = "20px"
```

In this example, the `font-size` property is bound to a pointer, and the color is bound to a computed value, where `it` references an element for which the selector is applied.
