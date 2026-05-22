## 2024-05-22 - [Add aria-controls to Utility Dock trigger]
**Learning:** Adding aria-controls to expandable elements like the utility dock helps screen readers associate the trigger button with the content body, making it clear which part of the interface is being toggled.
**Action:** When implementing custom accordions or expandable sections, always add `aria-controls` to the trigger element linked to the content body's ID, in addition to managing the `aria-expanded` state.
