# Menu and system status

| Area | Behavior |
| --- | --- |
| Desktop/mobile menu | Includes a “Component library” link to `/preview`. |
| Homepage footer | A platform status panel replaces the plain health link, including check time and a details link. |
| Updates | Reads `/api/health` on load, every minute while visible and when returning to the tab; 8-second timeout. |
| Result | Distinguishes checking, operating normally, temporarily unavailable and unable to confirm. Failed requests never appear healthy. |
| Language | Content, menu labels and check time support Vietnamese and English. |

This reflects the platform endpoint check, not a guarantee of every external integration or individual sandbox's health.

The footer is reduced to the logo, 95LAB and system status; navigation links already live in the menu. The FAQ describes managing an app after creation.
