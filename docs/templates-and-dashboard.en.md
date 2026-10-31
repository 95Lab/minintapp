# Template library and dashboard access

| Area | Design and access |
| --- | --- |
| `/templates` | Public; shares the homepage logo/header, paper background, terracotta accent and typography. |
| Template creation | Select 1 hour, 24 hours or 7 days; template creation does not call AI. |
| Mobile | Single-column cards, select fields at least 44 px tall, keyboard focus support. |
| `/dashboard` | Checks the session before fetching apps; guests are redirected to `/login`. Session check failures show a message and sign-in link. |
| `/api/my-apps` | Returns 401 without a signed-in session; retains ownership filtering by account and current browser session. |

Apps created in another browser need to be linked to the account to appear in the same list. Host permissions on app pages and deployment mutation APIs are still checked independently.
