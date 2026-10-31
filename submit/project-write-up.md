# MinintApp

**Temporary problem. Temporary software.**

**Team:** 95LAB — Hiếu Nd, Thức Nguyễn, Mai Phan  
**Build direction:** AI-Native Products & Operations  
**Repository:** <https://github.com/95Lab/minintapp>  
**Demo:** To be added.

## Problem

During a workshop, the host needs a live vote before continuing. A small business needs a registration tool for tomorrow's event. Both need a working, shareable tool quickly, but configuring forms, collecting responses, and presenting results takes time. A custom app adds coding and hosting work.

When a useful tool could serve other groups, its creator also needs a way to distribute it. Each group needs its own data and the ability to adapt the app.

## Solution

MinintApp is designed as one platform to create, run, share, and optionally sell AI-generated **Flash Apps** through natural-language requests.

**Describe → Preview → Edit → Publish → Use and share**

Users test and refine an app through conversation, then publish it with its own HTTPS subdomain and data. They can keep, improve, stop, or expire it.

Creators can separately list a released version on a marketplace. Others can create a private copy with empty data. App rights and hosting costs are disclosed separately; paid transactions and creator payouts are later phases.

## Build direction

MinintApp fits [AI-Native Products & Operations](https://codexhackathon.sea.com/): AI creates and modifies the application itself, while the platform manages its execution, data, and distribution.

## MVP and technology

The target demo is a workshop voting app: preview and edit it, publish and share its URL/QR, then let another user create an independent copy from a free marketplace listing.

The proposed architecture separates platform management from app execution:

- **Control Plane:** Next.js dashboard, Node.js/TypeScript API, PostgreSQL metadata, and Redis/BullMQ jobs. A Codex-powered builder generates and validates code from a template.
- **Runtime Plane:** One VM hosting multiple Docker/gVisor sandboxes for the demo. Each app has a dedicated SQLite data volume.
- **Publishing:** Cloudflare provisions subdomains; Traefik routes requests to the correct sandbox. An app is marked running only after its public route passes verification.

Builds run separately from published apps. Copies receive no creator production data or secrets. Multi-VM recovery and real payments are later phases.

## How we use Codex

Codex assists with implementation, tests, and documentation through small tasks with clear acceptance criteria. Team members review changes and run relevant checks. Using Codex inside the platform's AI Builder is a planned integration, separate from its use as our development assistant.

## Current status

The current build supports template-based voting, host/participant pages, QR sharing, polling updates, and close/reopen/end controls. Data is held in memory and is lost on restart. An OpenAI generation adapter exists but is not connected to the app-creation flow.

VPS deployment configuration is prepared; live deployment is not yet confirmed. The sandbox architecture, conversational builder, subdomain provisioning, and marketplace remain planned.

*Draft: update delivered features, verified results, and the demo link before PDF export.*
