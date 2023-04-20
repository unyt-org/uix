## interface **Group.Options**

## class **Group**\<O extends Group.Options = any, ChildElement extends Base = Base>
### Constructors
 **constructor**(options?: Datex.DatexObjectInit, constraints?: Datex.DatexObjectInit, elements?: ChildElement[])

### Properties
**elements**: ChildElement[]<br>
**element_constraints**: Types.component_constraints[]<br>
**initialized_elements**: Set<br>
**anchored_elements**: Set<br>
**current_max_index**: number<br>
`protected` **active_element**?: ChildElement<br>
`protected` **elements_by_id**: Map<br>
`protected` **slot_element**: HTMLSlotElement<br>
`protected` **focus_next**?: HTMLElement<br>
`protected` `override` **default_context_menu**: Types.context_menu<br>

Base class for element groups

