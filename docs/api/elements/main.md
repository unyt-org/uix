## type **Elements.form_item**\<T = unknown> = {value: Datex.CompatValue,label?: Datex.CompatValue,options?: Iterable,params?: Record,input?: ValueInput,}

## interface **Elements.Base.Options**

## interface **Elements.Image.Options**

## interface **Elements.Document.Options**

## interface **Elements.Header.ElementData**

## interface **Elements.Header.Options**

## interface **Elements.Button.Options**

## interface **Elements.ToggleButton.Options**

## interface **Elements.Checkbox.Options**

## interface **Elements.ValueDisplay.Options**

## interface **Elements.Number.Options**

## interface **Elements.ValueInput.Options**

## interface **Elements.ContainerValueInput.Options**

## interface **Elements.NumberInput.Options**

## interface **Elements.QuantityInput.Options**

## interface **Elements.ValueSelect.Options**

## interface **Elements.DropdownMenu.Options**

## interface **Elements.ValueList.Options**

## class **Elements.Base**\<O extends Elements.Base.Options = Elements.Base.Options>
### Constructors
 **constructor**(options?: O)

### Properties
`protected` **options**: O<br>
`protected` **wasLoadedStatic**: any<br>


## class **Elements.Form**
### Constructors
 **constructor**(items: form_item[])



## class **Elements.Image**
### Constructors
 **constructor**(options?: Image.Options)



## class **Elements.Document**
### Constructors
 **constructor**(options?: Image.Options)

### Properties
**pdfjsLoaded**: boolean<br>


## class **Elements.Header**
### Constructors
 **constructor**(element_data: Header.ElementData[], options?: Header.Options)

### Properties
`protected` **container**: HTMLElement<br>
`protected` **elements**: HTMLElement[]<br>
`protected` **element_data**: Header.ElementData[]<br>
`protected` **drag_el**: HTMLElement<br>

simple header element with arbitrary sub elements, supports windowControlsOverlay

## class **Elements.Value**\<T, O extends Elements.Base.Options = Elements.Base.Options>
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: O)



## class **Elements.Button**\<O extends Elements.Button.Options = Elements.Button.Options>
### Constructors
 **constructor**(options?: O)



## class **Elements.ToggleButton**
### Constructors
 **constructor**(options: Elements.ToggleButton.Options)



## class **Elements.Checkbox**
### Constructors
 **constructor**(options?: Elements.Checkbox.Options)



## class **Elements.ToggleSwitch**
### Constructors
 **constructor**(options?: Elements.Checkbox.Options)



## class **Elements.ValueDisplay**\<T, O extends Elements.ValueDisplay.Options = Elements.ValueDisplay.Options>
### Constructors
 **constructor**(value: Datex.CompatValue, options?: O)



## class **Elements.Text**


## class **Elements.Number**
### Constructors
 **constructor**(value: Datex.CompatValue, options?: Number.Options)



## class **Elements.ValueInput**\<T, O extends ValueInput.Options = ValueInput.Options>
### Constructors
 **constructor**(value?: Datex.CompatValue, type: any, options?: O)



## class **Elements.TextInput**
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: ValueInput.Options)



## class **Elements.EMailInput**
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: ValueInput.Options)



## class **Elements.PasswordInput**
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: ValueInput.Options)



## class **Elements.ContainerValueInput**\<T, O extends ContainerValueInput.Options = ContainerValueInput.Options>
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: ContainerValueInput.Options)

### Properties


## class **Elements.NumberInput**\<T extends number | bigint | Quantity, O extends NumberInput.Options = NumberInput.Options>
### Constructors
 **constructor**(value: Datex.CompatValue, options?: O)

### Properties
`protected` **input_validation_regex**: RegExp<br>
`protected` **input_validation_regex_complete**: RegExp<br>


## class **Elements.IntegerInput**


## class **Elements.FloatInput**


## class **Elements.QuantityInput**\<U extends Unit>
### Constructors
 **constructor**(value: Datex.CompatValue, options: QuantityInput.Options)

### Properties
**unit**: unit<br>


## class **Elements.DateInput**
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: ValueInput.Options)



## class **Elements.FileInput**
### Constructors
 **constructor**(value?: Datex.CompatValue, options?: ValueInput.Options)



## class **Elements.PercentageBar**
### Constructors
 **constructor**(value: Datex.CompatValue, min: number, max: number, color?: Datex.CompatValue)



## class **Elements.PercentSlider**
### Constructors
 **constructor**(value: Datex.CompatValue)



## class **Elements.ColorWheel**
### Constructors
 **constructor**(color: Datex.CompatValue)

### Properties


## class **Elements.IterableValue**\<T, MT = T, O extends Base.Options = Base.Options>
### Constructors
 **constructor**(list?: Datex.CompatValue, options?: O)



## class **Elements.ValueSelect**\<O extends ValueSelect.Options = ValueSelect.Options, V = any>
### Constructors
 **constructor**(options?: O)

### Properties
**displayed_option_name**: Datex.Value<br>
**selected_option_index**: Datex.Value<br>
**selected_option_name**: Datex.Value<br>
**selected_option_value**: Datex.Value<br>
`abstract` **options_container**: HTMLElement<br>


## class **Elements.DropdownMenu**
### Constructors
 **constructor**(list: Datex.CompatValue, options?: DropdownMenu.Options)

### Properties
**options_container**: HTMLElement<br>


## class **Elements.RadioSelectMenu**
### Constructors
 **constructor**(list: Datex.CompatValue, options?: ValueSelect.Options)

### Properties
**options_container**: HTMLElement<br>


## class **Elements.ValueList**\<T>
### Constructors
 **constructor**(list: Datex.CompatValue, options?: ValueList.Options, transform?: unknown - todo)



## function **Elements.getInputElementForValue** \<T = any>(value: Datex.CompatValue, params: Record): Elements.Base



