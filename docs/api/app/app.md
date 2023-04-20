## type **app_options** = {name?: string,description?: string,icon_path?: string,version?: string,stage?: string,installable?: boolean,offline_support?: boolean,frontend?: string | URL | unknown - todo[],backend?: string | URL | unknown - todo[],common?: string | URL | unknown - todo[],import_map_path?: string | URL,import_map?: {imports: Record,},}

## interface **normalized_app_options**

## function **getDirType** (app_options: normalized_app_options, path: Path)



## function **urlToPath** (url: string | URL)



## function **validateDirExists** (url: URL, type: string)



## const **ALLOWED_ENTRYPOINT_FILE_NAMES**: string[]

## const **App**: UIXApp

