## 2024-05-22 - [Add aria-controls to Utility Dock trigger]
**Learning:** Adding aria-controls to expandable elements like the utility dock helps screen readers associate the trigger button with the content body, making it clear which part of the interface is being toggled.
**Action:** When implementing custom accordions or expandable sections, always add `aria-controls` to the trigger element linked to the content body's ID, in addition to managing the `aria-expanded` state.
## 2024-07-01 - [Add missing aria attributes to tablists and unicode icon buttons]
**Learning:** Found multiple instances where `role="tablist"` was used for navigation pills, but the child elements were missing `role="tab"` and dynamic `aria-selected` attributes. Also, buttons containing unicode arrows (like `← Back`) can be confusing for screen readers without a clear `aria-label`.
**Action:** When creating custom tab navigations using `role="tablist"`, always ensure child buttons have `role="tab"` and `aria-selected` explicitly managed. Add descriptive `aria-label`s to buttons containing non-alphanumeric unicode characters.
