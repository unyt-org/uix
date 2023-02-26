# UIX - Extendable UI Framework based on DATEX

## How to use UIX

With UIX, you can create reactive, responsive web apps with restorable and shared state. UIX focuses on single page applications and supports modern web app features.

There are four main ways to design UIX components and create UIX applications:
 * using the **UIX Web Editor**
 * using the **TypeScript/JavaScript UIX Library** (focus of this documentation)
 * writing **HTML** markup
 * defining UIX states with **DATEX**

The whole UIX library is designed with a modular approach
that makes it very easy for developers to add their own custom
components as needed.

## Benefits of the UIX/DATEX ecosystem

In general, a UIX front-end can be integrated seamlessly into complex full-stack applications thanks to DATEX.
If you are developing a unyt-based application, the UIX library is a good choice for a front-end framework
since it is designed to work great in combination with DATEX.
UIX also supports seamless transitions between server- and client-side rendering.
 
UIX Component states, including tabs, open files, cursor positions and more, are synchronized with DATEX pointers and can be restored at any time.

The library also comes with a set of built-in functionalities, like handling drag and drop, context menus, files, and others.
The UIX Standard Library includes a variety of basic components, from simple text views to file trees.

UIX provides a layer of abstraction so that direct DOM manipulation with CSS and HTML is not necessarily required for creating an app with basic Components, but the implementation of more complex Components might still require CSS and HTML.
However, the saved state of a UIX Component should not contain web-specfic content like css attributes or HTML element names, since UIX is also intended to work in non-web environments.


## Open-Source UIX Components

Verified UIX components can be shared as **public DATEX types** via the unyt marketplace.
We encourage you to publish your custom components to the unyt Marketplace or other open source platforms like GitHub.


----
UIX (Standard Library) includes the following open source projects:
* DATEX JS Runtime (unyt_core, unyt_web)
* Monaco Editor
----

## Basic UIX project

To add content to your UIX app, you need to create new UIX component.

The UIX Core Library includes a couple of basic components, available under `UIX.Components.*`

Some of those core components are group components like `UIX.Components.TabGroup` `UIX.Components.GridGroup`, or normal components like `UIX.Components.TextView`.

You can display any UIX component on the page by calling the `.anchor()`
method.
Each component comes with its own set of options that can be set when creating a new instance.

```typescript
import { UIX } from "uix";

// create a new text component
let text = new UIX.Components.TextView({
    text: "Hi world",
    padding: 10
});

// anchor the text to the html body
text.anchor(); // or document.body.append(text)
```

## Component Classes

### Nested components

Classes that extend the `UIX.Components.Group` class can have child components.

```typescript
// create a new group
// define the grid (css grid) where child components can be put:
// 2 columns filling 1 fraction each & one full height row
let group = new UIX.Components.GridGroup ({
    columns: [1, 1],
    rows: [1], 
    background: null, 
    accent_color:"#0b73d0"
}, {margin:10});

// add a child component to the group (default position is 0,0; size is 1,1)
group.addChild(new UIX.Components.TextView({
    text: "Hello again"
}))

// add the group to the body
group.anchor();
```

### Creating custom Components

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


### Defining custom options 

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

### Component Lifecycle


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


## Saved States

### Component states

The `options` and the `constraints` property are part of the component state by default and are exposed to DATEX.
Every change to the `options` or `constraints`, or any of their child properties is synced over DATEX and can be restored.

Since UIX components are normal DATEX JS template classes, additional DATEX-exposed properties can be declared using the `@property` decorator:

```typescript
@UIX.Component class CustomComponent extends UIX.Components.Base {

    // declare custom restorable properties
    @property custom1 = 'default value'
    @property custom1 = new Map<number,Set<number>>()
    @property textView: UIX.Components.TextView

	onConstruct() {
	    this.textView = new UIX.Components.TextView({text:'Hi'}); // the this.textView property is restored when the component recreated
	}

	// called always after construction or recreation
	onInit() {
		this.logger.info(this.textView); // this.textView exists
	}
}

```

### Global states

Persistent values can also be created outside of components with the `eternal` label:
```typescript
const counter = eternal ?? $$(0);
counter.val ++; // counter gets incremented every time the page is reloaded
```


### Page state

The saved UIX page state can be created/restored by intializing all Components in the `UIX.State.saved` method. The root component needs to be returned:
```typescript
// before page loaded ...

await UIX.State.saved(() => new UIX.Components.TextView({text:"Hi"}));

// the page is now loaded
```

## How to Develop
The main branch is `develop`. This repository uses a workflow like described [here](https://medium.com/trendyol-tech/semantic-versioning-and-gitlab-6bcd1e07c0b0).
To develop a feature, branch of develop and call the branch `feature/YOUR-NAME`. When finished, go to Gitlab > CI > Pipelines > Run Pipeline > select your branch, add a variable called `DEPLOY_TYPE` and `major` or `minor` as value.
This creates a release branch, and merge request.
When making fixes to a branch (refer to the article), branch off the release branch and do a manual merge request to the branch in question