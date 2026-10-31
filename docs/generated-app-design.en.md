# Generated app interface standard

Shared across `/rooms`, `/a` and the standalone poll runtime. Prioritize phones, readable content, one primary task and clear action labels. Apps built from standard blocks receive the shared interface when the updated runtime loads.

| Element | Standard |
| --- | --- |
| Color and type | Warm paper, dark ink and restrained theme accents; system/Geist typography. Rooms use a consistent light appearance. |
| Layout | Participant content up to 600 px wide; two host columns on large screens, one on phones. |
| Interaction | Buttons at least 44 px, input fields 48 px, form text 16 px; visible keyboard focus. |
| Long content | Wrap text; tables scroll within their own container without widening the page. |
| State | Preserve sent/error feedback, disabled controls and existing host permissions. |
| Custom mini games | Base iframe styles and AI instructions for 320 px layouts, clear labels, readable contrast and reduced motion. Generated CSS can still override base styles. |
| Standalone runtime | Polls share the same palette, spacing and touch target standard. |

App data and API contracts are unchanged. Sandboxes running an older image need an updated image deployment to receive the new CSS. Base styles cannot guarantee the appearance of arbitrary custom HTML that supplies its own CSS; these apps still need individual review.
