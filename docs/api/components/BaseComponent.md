## type **propInit** = {datex?: boolean,}

## type **standaloneContentPropertyData** = {type: id | content | layout | child,id: string,}

## type **standalonePropertyData** = {type: prop,}

## type **standaloneProperties** = Record

## interface **BaseComponent.Options**

## class **BaseComponent**\<O extends BaseComponent.Options = BaseComponent.Options, ChildElement extends HTMLElement = HTMLElement>
### Constructors
 **constructor**(options?: Datex.DatexObjectInit)

### Properties
**DEFAULT_OPTIONS**: BaseComponent.Options<br>
**CLONE_OPTION_KEYS**: Set<br>
**[METADATA]**: any<br>
**[Datex.DX_TYPE]**?: Datex.Type<br>
**options**: Datex.JSValueWith$<br>
********************************** END STATIC **************************************
**props**: Datex.DatexObjectInit & {children?: ChildElement | ChildElement[],}<br>
**\$**: Datex.Proxy$<br>
**\$\$**: Datex.PropertyProxy$<br>
**[METADATA]**: any<br>
**[OPEN_GRAPH]**?: OpenGraphInformation<br>
**standalone**: boolean<br>
true if component is in standalone mode (UIX library not loaded)
`protected` **stylesheets**: string[]<br>
********************************** STATIC **************************************
`protected` **_module**: string<br>
`protected` **_use_resources**: boolean<br>
`protected` **standaloneProperties**: standaloneProperties<br>
`protected` **SCROLL_TO_BOTTOM**: boolean<br>
`protected` **FORCE_SCROLL_TO_BOTTOM**: boolean<br>
`protected` **CONTENT_PADDING**: boolean<br>
`protected` **openGraphImageGenerator**?: OpenGraphPreviewImageGenerator<br>
`protected` **is_skeleton**: boolean<br>
`protected` **style_sheets_urls**: string[]<br>
`protected` **routeDelegate**?: BaseComponent<br>


