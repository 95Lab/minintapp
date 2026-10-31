# Platform interface

The homepage and its `m· / minintapp.` logo define the brand. `BrandLogo` is shared by home, login, the dashboard sidebar, and runtime headers. `SiteHeader` serves home, the template library, account screens, and other top-bar layouts.

Japanese minimalism is expressed through deliberate space, warm paper, ink-colored typography, one vermilion accent, and light borders. Decorative Japanese characters and functional changes are not used as styling devices. Primary actions and readable information take priority.

- Home always shows sign-in without a session, including while session status loads. A valid session replaces it with the account menu.
- Mobile keeps the logo, sign-in, and a touch-friendly menu button visible. Navigation, language, and app creation live in the menu; Escape closes it and returns focus to its toggle.
- Primary touch targets are at least 44 px high; mobile prompt inputs use 16 px text to avoid unwanted zoom. No horizontal overflow at 320/390 px.
- Vietnamese/English copy, clear keyboard focus, and reduced-motion preferences are supported. Individual app content colors/themes remain controlled by AppSpec.

Browser checks cover visible sign-in, mobile menus, keyboard access, language, and signed-in state. Provider connectivity is not required for these interface checks.
