/**
 * Components
 * 
 * @implement methods:
 * 
 * - onAnchor()              after anchoring
 * - onBeforeChildren()      before children loaded (assembled)
 * - onReady()               after children loaded (assembled)
 * - onShow()                when shown
 * - onInit()                called after DATEX generator or replicator
 * - onFirstShow()           when newly created and first shown
 * - onHide()                when element is created with options.hidden set to true, or when hide() is called
 * - onConstraintsChanged()  when element size or position changed
 * - hasValidOptions()       return if required options are all set / valid 
 * - requiredOptionsList()   return a list of required options with types etc. for manual initializazion
 * - createContextMenu()     return an object with context_menu_items
 * - onRemove()              called after removed from DOM (not moved)
 * - onClick(...)
 * 
 * @observers - register callback function:
 * - onFlagAdded(...)
 * - onFlagRemoved(...)
 * */

import * as Components from "./all.ts"
export {Components};