
# Components

## Creating component functions

The easiest way to get a component-like behaviour is to use a simple function that returns an HTML Element.
With this approach, you can still get reactive behaviour and saved states, but you don't get any advanced component features, like
lifecycle handlers and utility methods.

```tsx
function MyComponent(props: {children: HTMLElement[], color: string, countstart: number}) {
    // create a counter pointer and increment every second
    const counter = $$(props.countstart);
    setInterval(() => counter.val++, 1000);

    // return component content
    return <div style={{background:props.color}}>
            	Count: {counter}
            	{...props.children}
    	   </div>
}

export default
    <MyComponent color="green" countstart={42}>
        <div>child 1</div>
        <div>child 2</div>
    </MyComponent>
```

## Creating custom component classes

You can create custom UIX components by extending `UIX.Components.Base` or another UIX Component class and register it by decorating the class with `@UIX.Component`.


```typescript
// register the component and set default options
@UIX.Component
class MyCustomComponent extends UIX.Components.Base {

    @UIX.content helloText = "Hello from my custom component"

}
```
If you want to define an abstract Component class that is not intended to be used as an actual Component, you can mark it with `@UIX.Abstract`.


A UIX Component also inherits the default options from its parent class.


## Defining custom options 

The `UIX.Components.Base.Options` interface can also be extended for custom Component options. 
The interface and any related classes or variables should be put in the namespace of the component class:


```typescript
// component namespace
namespace MyCustomComponent {
    export interface Options extends UIX.Components.Base.Options {
        strings:string[]
    }
}

// register the component and set default options
@UIX.Component<MyCustomComponent.Options>({
    border_radius: 20,
    strings: ['a string', 'morestring']
})
class MyCustomComponent extends UIX.Components.Base<MyCustomComponent.Options> {

    @UIX.content helloText = "Hello from my custom component"

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
class ParentComponent extends UIX.Components.Base {
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


## Internal component layout (Shadow DOM)

A UIX Component has the following structure:
```html
<uix-component>

    <!--Shadow DOM-->
    #shadow-root
        <div id="content_container">
            <!--internal layout-->
            <div>Internal Layout</div>
            <!--content slot-->
            <slot id="content">
                <!--virtual children-->
                <div>child 1</div>
                <div>child 2</div>
            <slot>
        </div>

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
class ParentComponent extends UIX.Components.Base {
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
class ParentComponent extends UIX.Components.Base {
    @layout componentTitle = <div>Component Title</div>
    @content customContent = <div>Content</div>
}

export default <ParentComponent/>
```



## Component lifecycle


```typescript
@Component class CustomComponent extends UIX.Components.Base {

    // called when component is constructed
    onConstruct() {}

    // called after component is constructed or restored
    onInit() {}

	// called once before onAnchor
    onCreate() {}

    // called when the component is added to the DOM
    onAnchor() {}

    // called after onAnchor, when the component is displayed in a browser context
    onDisplay() {}

}

```

## CSS styles

To apply css styles to a component in a module `my_component.ts`, you can create a file next to the module file, called `my_component.css`. 
The styles declared in this file are automatically applied to instances of the component.

For global css styles, you can add a `entrypoint.css` file next to the `entrypoint.ts` file.