
# Component Classes

## Creating custom Components

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

## Component Lifecycle


```typescript
@UIX.Component class CustomComponent extends UIX.Components.Base {

    // called after @constructor
    onConstruct() {}

    // called after @constructor or @replicator
    onInit() {}

	// called once before onAnchor
    onCreate() {}

    // called when the component is added to the DOM
    onAnchor() {}
	
}

```

## CSS Styles

To apply css styles to a component in a module `my_component.ts`, you can create a file next to the module file, called `my_component.css`. 
The styles declared in this file are automatically applied to instances of the component.

## Open-Source UIX Components

Verified UIX components can be shared as **public DATEX types** via the unyt marketplace.
We encourage you to publish your custom components to the unyt Marketplace or other open source platforms like GitHub.


----
UIX (Standard Library) includes the following open source projects:
* DATEX JS Runtime (unyt_core, unyt_web)
* Monaco Editor
----