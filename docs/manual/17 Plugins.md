# Plugins

UIX provides a way to write app plugins in the form of [DATEX Plugins](https://github.com/unyt-org/datex-specification) and use them in `app.dx` files.
App plugins are always called before the UIX app is started.

An example of an app plugin is the [Git Deploy Plugin](https://cdn.unyt.org/uix/plugins/git-deploy.ts), which is included in any UIX app.

## Using plugins

Plugins can be used in an `app.dx` file with the `plugin` keyword.
The content of the plugin body depends on the plugin.

Example (`git_deploy` plugin):
```datex
plugin git_deploy (
    prod: (
        on: 'push',
        branch: 'main'
    )
);
```

A plugin initialization may also not contain any content at all:
```datex
plugin my_plugin ();
```

## Activating custom plugins

You can enable your own or third-party plugins by placing the plugin URL in a `plugins.dx` file in your project root next to the `app.dx` file.

Example `plugins.dx` file:

```datex title="plugins.dx"
https://cdn.unyt.org/uix/plugins/git-deploy.ts,
https://example.com/my-plugin.ts,
../plugins/my-plugin.ts
```

## Writing custom plugin modules

UIX provides an `AppPlugin` TypeScript interface that can be implemented to create a custom plugin.

The plugin class must be exported as the default export from the plugin module file.
The plugin name must start with `[A-Za-z_]` and can only contain `[A-Za-z0-9_]`.

**Example:**

```ts title="my-plugin.ts"
import { AppPlugin } from "uix/app/app-plugin.ts";

export default class MyPlugin implements AppPlugin<{text: string}> {
    // the identifier used to refer to this plugin in a DATEX file 
    name = "my_plugin"

    // this method is called when the plugin is used in a DATEX file
    apply(data: {text: string}) {
      console.log("my plugin text: " + data.text);
    }
}
```

**Usage:**

* Activate in `plugins.dx`:
  ```datex
  ./my-plugin.ts 
  ```

* Use in `app.dx`:
  ```datex
  plugin my_plugin ({
    text: "Hello Plugin"
  });
  ```
