# Plugins

UIX provides a way to write app plugins in the form of [DATEX Plugins](https://github.com/unyt-org/datex-specification)
and use them in `app.dx` files.
App plugins are always called before the UIX app is started.

An example for an app plugin is the [Git Deploy Plugin](https://cdn.unyt.org/uix/plugins/git-deploy.ts) which is available per
default in any UIX app.

## Activating custom plugins

You can activate your own or third-party plugins by putting the plugin URL in a `plugins.dx` file in your project root 
next to the `app.dx` file.

Example `plugins.dx` file:

```dx
https://cdn.unyt.org/uix/plugins/git-deploy.ts,
https://example.com/my-plugin.ts,
../plugins/my-plugin.ts
```

## Using plugins

Plugins can be used in the `app.dx` file with the `plugin` keyword.
The content of the plugin body depends on the plugin.

Example (git_deploy plugin):
```dx
plugin git_deploy (
  prod: (
    on: 'push',
    branch: 'main'
  )
);
```

Plugin initialization might also not contain any content at all:
```dx
plugin my_plugin ();
```


## Writing Plugin Modules

UIX provides a `AppPlugin` TypeScript interface that can be implemented
to create a plugin.

The plugin class must be exported as a default export from the plugin module file.
The plugin name must start with `[A-Za-z_]` and can only contain `[A-Za-z0-9_]`.

**Example:**

```ts
// file: my-plugin.ts
import { AppPlugin } from "uix/app/app-plugin.ts";

export default class MyPlugin implements AppPlugin<{text: string}> {
    // the identifier used for this plugin in a DATEX file 
    name = "my_plugin"

    // this method is called when the plugin is used in the app.dx file
    apply(data: {text: string}) {
      console.log("my plugin text: " + data.text);
    }
}
```

**Usage:**

* Activate in `plugins.dx`:
  ```dx
  ./my-plugin.ts 
  ```

* Use in `app.dx`:
  ```dx
  plugin my_plugin ({
    text: "Hello Plugin"
  });
  ```
