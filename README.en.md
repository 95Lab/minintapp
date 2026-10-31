# MinintApp

[Tiếng Việt](README.md) | [English](README.en.md)

### An all-in-one platform to create, run, and sell AI-generated Flash Apps

> **Turn a need into an app. Turn an app into a business opportunity.**
>
> Temporary problem. Temporary software.

![Status](https://img.shields.io/badge/status-hackathon%20proposal-orange)
![Powered by](https://img.shields.io/badge/powered%20by-Codex-black)
![MVP target](https://img.shields.io/badge/MVP%20target-7%20hours-blue)

## 1. The idea

**MinintApp** helps people without programming skills create **interactive Flash Apps** by describing their needs in natural language. The platform manages app generation, data, sandboxes, subdomains, and deployment, while providing a marketplace where the community can discover, use, buy, and sell apps.

Example:

> “Create a voting app for today's workshop with five candidates, one vote per person, and real-time results.”

Users receive a preview, refine it through conversation, and publish to a dedicated HTTPS subdomain for sharing through a link or QR code. Apps can serve temporary needs, remain available long term, or become marketplace products.

**Status:** The repository now includes a Next.js application, interactive engine, and Control/Runtime Plane implementation with PostgreSQL, queues, gVisor sandboxes, dedicated PostgreSQL databases and roles, and DNS provisioning. See the [runtime architecture](docs/architecture-runtime.en.md) for implemented behavior and remaining limits. Marketplace and payments remain on the roadmap.

## 2. The all-in-one experience

```text
Describe a need → AI generates an app → Test and refine → Publish
    → Use and share → Optionally list on the marketplace
    → Others discover it and create their own instances
```

| Capability | Value |
|---|---|
| AI creation | Turn needs into apps without writing code yourself |
| Integrated operation | Platform-managed sandboxes, dedicated data, and HTTPS subdomains |
| Instant sharing | Others open a link or scan a QR code to use the app |
| Marketplace | Creators list free or paid apps |
| Dedicated instances | Buyers receive independent instances and data, customizable under the license |
| Creator community | Discovery, feedback, improvements, and licensed remixes |

The initial commercial model sells **the right to create a dedicated app instance from a released version**. App purchase prices and operating fees are disclosed separately; purchasing an app does not automatically include source code, resale rights, or lifetime hosting.

## 3. Proposed architecture

- **Control Plane:** dashboard, API, PostgreSQL, queue, AI Builder, and Scheduler.
- **Runtime Plane:** multiple VM Workers, each app running in its own gVisor sandbox with a dedicated data volume.
- **Routing:** the Cloudflare DNS API provisions subdomains; a gateway routes to sandboxes, separating DNS from VM placement.
- **Lifecycle:** create, build, deploy, run, stop, extend, and expire.

The demo colocates components on **one VM with N sandboxes**. The Worker Agent interface is designed for later expansion to multiple VMs.

## 4. MVP and demo scenario

Seven-hour scope: one full-stack template, prompt → preview → edit → publish, dedicated PostgreSQL databases and roles per app, real subdomains through the Cloudflare API, start/stop, and TTL. The demo marketplace provides sample categories and free instance creation.

1. Generate a workshop voting app from a prompt and receive an HTTPS subdomain.
2. Publish a free template on the marketplace.
3. Another account creates an instance with empty data and customizes it for another workshop.
4. The two apps run in independent sandboxes; stopping one leaves the other running.

Real payments, refunds, creator payouts, automatic VM provisioning, and cross-VM recovery belong to later phases. The demo VM remains a shared point of failure.

## 5. Documentation

| Document | Tiếng Việt | English |
|---|---|---|
| Overview | [README](README.md) | [README](README.en.md) |
| Architecture | [Thiết kế kiến trúc](architecture-design.md) | [Architecture Design](architecture-design.en.md) |
| Product and business | [Business Flow](business-flow.md) | [Business Flow](business-flow.en.md) |

## Team

**Team name:** 95LAB

| Contact | Details |
|---|---|
| Contact person | Hiếu Nd (Team Lead) |
| Email | [hillnguyen528@gmail.com](mailto:hillnguyen528@gmail.com) |
| Phone | 0969 895 364 |

**Members**

| Member | Role | Education / Expertise |
|---|---|---|
| **Hiếu Nd** | Team Lead | Master's degree in Information Technology, UEF – Ho Chi Minh City University of Economics and Finance |
| **Thức Nguyễn** | Member · AI Developer | Graduate student, University of Information Technology, Vietnam National University Ho Chi Minh City (UIT) |
| **Mai Phan** | Member · AI Developer | Graduate student, University of Information Technology, Vietnam National University Ho Chi Minh City (UIT) |

---

**Create it when you need it.**

**Keep it as long as you want.**

**Let it disappear when you don't.**
