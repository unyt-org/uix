## type **State.app_meta** = {name?: string,description?: string,version?: string,stage?: string,backend?: Datex.Endpoint,}

## function **State.onVersionChange** (handler: version_change_handler)



## function **State._setMetadata** (meta: app_meta)



## function **State.loadingScreen** (title?: string, icon_path: any, border_path?: string)



## function **State.setLoadingProgress** (percent: number)


percent in 0-1

## function **State.addLoadingProgress** (percent: number)



## function **State.loadingFinished** ()



## function **State.reset** ()



## function **State.saved** (new_state_pages: unknown - todo, state_name?: string): Promise



## function **State.saved** (load_new_state: unknown - todo, state_name?: string): Promise



## function **State.saved** (load_new_state: unknown - todo, state_name: string): Promise



## function **State.set** (content: html_content_or_generator_or_preset, path: any)



## function **State.exportState** (uix_component: any)



## function **State.exportStateBase64** (uix_component: any)



## function **State.importState** (dx: string)



## function **State.importStateBase64** (dx: string)



## function **State.getCurrentState** ()



## const **State.APP_META**: app_meta

## const **State.resetPage**: any
reset methods

## const **State.resetPageAndClearEndpoint**: any

