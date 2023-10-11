# Localization

Localized text content in UIX can be realized
with dynamic text pointers that change their value
depending on the current language.

The easiest way to create text values for different languages
is to define them in a DATEX Script file using the `localtext` helper function:

```dx
// file: localized.dx
use localtext from #std;

export const plane = localtext {
  en: "Plane",
  de: "Flugzeug",
  fr: "Avion"
}
```

The exported `plane` pointer now contains a
text value that changes depending on the `DATEX.Runtime.ENV.LANG`.

It can be used inside any JS module and can be appended e.g. to an element content:
```ts
const {plane} = await datex.get("./localized.dx");
export default <h1>{plane} ✈️</h1>
```
