# Japanese interface

| Area | Behavior |
| --- | --- |
| Language selection | VI / EN / 日本語; persisted cookie, HTML lang and reload restoration. |
| Main content | Japanese translations for home, navigation, templates, sign-in, app management, guide and system status. |
| Typography | Japanese system fonts, line breaking and line height; mobile touch targets retained. |
| App content | Interface language is separate from app specs. Existing apps keep Vietnamese/English content; choosing Japanese does not change app data. |
| Fallback | Interface strings without Japanese translations use English; user content is not automatically translated. |

`japanese.ts` maps English interface strings to Japanese; shared `localize` supports components and server translation. App schemas, APIs, authentication sessions and credentials remain unchanged.
