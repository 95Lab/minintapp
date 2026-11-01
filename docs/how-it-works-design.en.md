# How it works design

| Element | Rule |
| --- | --- |
| Color | Component-local tokens render consistently on the homepage and `/how-it-works`, without relying on the home wrapper. |
| Create app | Primary action with an ink background and readable white text. |
| Live Demo | Secondary action with a white background, dark text and subtle border. |
| Explore templates | Supporting link after the two main actions. |
| Mobile | 44–48 px minimum controls; stacked on small screens without horizontal overflow. |
| Accessibility | Visible keyboard focus; selected steps use background, border and numbers; reduced-motion support. |

Shared across Vietnamese and English, without changing app creation or management behavior.

`/how-it-works` is now a purpose-built guide: one H1, three concise static steps, browser-local poll/quiz demo and a QR linking to the demo itself. Unconnected creation, authentication, remix forms and extension placeholders are removed from this page. Demo results reflect the local selection and can be reset; responses never reach the server. Page content supports Vietnamese, English and Japanese.
