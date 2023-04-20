## type **resource_meta** = {html?: string | HTMLElement,value?: string,filter_strings?: string[],transparent_filter?: boolean,type?: string,braces?: [string, string],identifier?: string,reference?: any,linked?: boolean,open?: boolean,}

## class **ResourceManger**
### Constructors
 **constructor**(resource_channel: string)

### Properties
**is_directory_can_change**: boolean<br>
**resource_managers**: Map<br>
**resource_rename_listeners**: Map<br>
***********************
**rename_listeners**: Set<br>
**resource_new_resource_listeners**: Map<br>
**new_resource_listeners**: Set<br>
**resource_remove_listeners**: Map<br>
**remove_listeners**: Set<br>
**resource_update_listeners**: Map<br>
**update_listeners**: Set<br>
`protected` **identified_elements**: Map<br>
from JSONTree **********

base class for all general resource (e.g. file or db) management

## class **Resource**
### Constructors
### Properties
**DEFAULT_CHANNEL**: string<br>
**resources**: Map<br>
**resource_manager**: ResourceManger<br>
**meta**: resource_meta<br>
**rename_listeners**: Set<br>


