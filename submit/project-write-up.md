# MinintApp — Project Write-up

**Small apps. Right when you need them.**  
*Temporary problem. Temporary software.*

**Team:** Team 35 — 95LAB (Hiếu Nd, Thức Nguyễn, Mai Phan)  
**Repository:** <https://github.com/95Lab/minintapp>  
**Demo:** <https://minintapp.io.vn/>

## 1. The problem we are solving

Many moments in group life call for a small tool that everyone can use together, but only for a few hours or days:
- **Learning:** A teacher or project team quickly creates a web app to practice lesson material.
- **Group meetings:** Agree on a venue, meeting time, or drinks without asking everyone individually in a group chat.
- **Workshops:** Start with a quiz, then open feedback questions one at a time to match the pace of the session.
- **Classrooms:** Run a quick knowledge check, collect survey responses, randomly select someone to answer, or divide the class into groups.
- **Trip expense management:** Spin a wheel to pick a restaurant, record shared expenses, and track total spending.
- **Any spontaneous idea:** A registration form, a mini game, or a quick request for feedback.

These needs share three characteristics: **they arise unexpectedly, involve multiple participants, and have a short lifespan**. Existing tools often require registration and setup, or a different application for each task. Building a custom application takes disproportionate effort: no one wants to build an entire system for something needed only today.

## 2. The solution we built

MinintApp is a platform for creating and using **Flash Apps** — small applications that are ready to use and can be ended when the need is over — from descriptions in Vietnamese or English, or from ready-made templates.

**Tell us what you need (describe it or choose a template) → Share a link/QR and invite everyone → Join in and see the results → End the app when it is no longer needed**

The live demo includes:

- **AI app creation (OpenAI):** Users discuss their idea with AI, confirm the requirements, and choose a lifetime of 1 hour, 24 hours, or 7 days. AI converts the request into an application configuration, which is checked for structure and rules before the interface is rendered from supported functional blocks.
- **Seven ready-to-use templates, no AI required:** Poll, quiz, participant lucky draw, choice wheel, multi-field survey, step-by-step survey, and expense tracker.
- **Participant experience:** Open a link or scan a QR code on a phone or computer without an account; enter a display name, submit answers, and see results update in real time.
- **Host management page:** Get a link/QR and monitor responses; close, reopen, or end an app; use dedicated quiz controls to reveal answers and lucky-draw controls to select winners; extend the app's lifetime, export CSV, and remix it by describing changes for AI to create a new version using the current app and its results.
- **"My apps" workspace:** View counts of all apps, running apps, apps being deployed, and apps needing attention because of errors or expiry; search by ID or domain, filter by status, and quickly access the template library.
- **Operating platform:** Persistent data storage on Supabase and Realtime synchronization across devices; a Control Plane, queue, and Worker manage sandboxes and dedicated data for each app. The interface supports Vietnamese and English and is optimized for mobile.

The range of apps AI can create depends on the functional blocks and rules currently supported by the runtime.

## 3. Alignment with a build direction

**Option 2 — AI-Native Products & Operations.**

AI turns a description of a need into a working application. The platform handles the interface, data, sharing, and lifecycle. People without programming skills can create a tool for their activity without setting up infrastructure: bring the idea, and MinintApp gives everyone a place to join in.

Next, the team will expand the functional block library to support more complex scenarios: coordinating family caregiving shifts, capacity-limited workshop registration and check-in, group meal ordering, and managing orders and inventory for a weekend fair booth.

## 4. How we used Codex

We used Codex to:

- Analyze business requirements, break down tasks, and design contracts between AI, the backend, and the interface.
- Develop the product interface, APIs, data adapters, and deployment components.
- Write tests, review changes, help fix bugs, and prepare documentation.

Each task has a clear scope and acceptance criteria. The responsible team member reviews the output and runs the relevant checks. Codex supports the development process; the product's app-generation flow uses OpenAI.
