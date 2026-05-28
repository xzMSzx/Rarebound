## 2024-05-22 - [Add aria-controls to Utility Dock trigger]
**Learning:** Adding aria-controls to expandable elements like the utility dock helps screen readers associate the trigger button with the content body, making it clear which part of the interface is being toggled.
**Action:** When implementing custom accordions or expandable sections, always add `aria-controls` to the trigger element linked to the content body's ID, in addition to managing the `aria-expanded` state.

## 2024-05-28 - Missing `aria-label` for Settings Toggle Switches
**Learning:** Found several toggle switch `<input type="checkbox">` elements in the `settingsScreen.js` UI that act as standalone inputs without enclosing `<label>` elements or `aria-labelledby` properties, meaning screen readers have no context on what they toggle.
**Action:** Always add descriptive `aria-label` tags to standalone UI inputs such as checkboxes or toggles when they aren't directly associated with visible `<label for="...">` elements.
