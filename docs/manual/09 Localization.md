# Localization
UIX allows for simple text content adaption depending on the users selected language.

Localized text content can be realized with the help of dynamic [text pointers](https://docs.unyt.org/manual/datex/pointers#pointers-for-primitive-values) that change their value depending on the users language.

To get the users current language setting (`DATEX.Runtime.ENV.LANG`) you can use the UIX shortcut property `UIX.language`.

## Using .dx localization file
The easiest way to create and load localizations is to define multiple languages in a [DATEX Script](https://docs.unyt.org/manual/datex/important-datex-concepts) (*.dx*) file using the `localtext` helper function:

```rust
// file: localized.dx
use localtext from #std;

export const plane = localtext {
  en: "Plane",
  de: "Flugzeug",
  fr: "Avion"
}
```

The exported `plane` pointer now contains a text value that changes depending on the language property.

Importing the localized property can be achieved by using the `datex.get` method. 
```ts
const { plane } = await datex.get("./localized.dx");
export default <h1>{plane} ✈️</h1>;
```

The DATEX Script may also be included in components using the [@use decorator](./04%20Components.md).

```tsx
import { Component } from "uix/components/Component.ts";
import { template } from "uix/html/template.ts";
import { use } from "uix/base/decorators.ts";

@template(function(this: MyApp) {
  return <h1>{this.plane} ✈️</h1>;
})
export class MyApp extends Component {
  @use("./localized.dx") declare plane: string;
}
```

## Inline definition
Localization may also be defined using the `local_text` method.
```tsx
import { local_text } from "unyt_core/datex_short.ts";

const strings = {
  title: local_text({
    de: 'Hallo Welt',
    en: 'Hello world'
  }),
  subtitle: local_text({
    de: 'Das ist meine App',
    en: 'This is my app'
  })
}

function myApp() {
  return <>
    <h1>{strings.title}</h1>
    <span>{strings.subtitle}</span>
  </>;
)
```

