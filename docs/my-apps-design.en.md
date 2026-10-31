# My apps interface

The `/my-apps` page uses the homepage header, logo and visual language: warm paper, dark ink, a terracotta accent, subtle borders and generous spacing.

| Area | Behavior |
| --- | --- |
| Overview | Four metrics independent of filters; two columns on phones. |
| Filters | Search by name/ID, status, expiry and order; responsive layout. |
| List | Status badge, expiry, host page, extension and end actions. |
| Bulk selection | Keeps confirmation before ending apps and reports batch results. |
| Empty account | Includes a direct action to create a new app. |

Buttons and input fields have a minimum height of 44 px, keyboard focus and reduced-motion support. APIs, ownership rules and app data remain unchanged.

`/my-apps` uses a workspace layout with a desktop sidebar, shared mobile navigation and orange primary actions. Account app data and extension/end operations retain their existing API rather than redirecting to a different deployment list. Tests are skipped for this deployment at the user's request; build and production verification remain.
