# MinintApp

**Temporary problem. Temporary software.**

**Team:** 95LAB — Hiếu Nd, Thức Nguyễn, Mai Phan  
**Build direction:** AI-Native Products & Operations  
**Repository:** <https://github.com/95Lab/minintapp>  
**Demo:** To be added.

## Problem

Consider a workshop where attendees need to vote on the next topic before the session can continue. Using chat messages means the host must count responses and announce the result manually, interrupting the activity.

A form can collect votes, but the host still needs to configure options, share access, and present results. If the next activity is a quiz or signup, another setup is needed. A custom app adds coding and hosting work for something used only briefly.

For workshop hosts, student organizers, and small teams, this setup effort takes time away from the activity itself. They need a shared tool that is quick to create, easy to join on a phone, and simple to close when the task ends.

## Solution

MinintApp is designed to let anyone describe a task in Vietnamese or English and get a shareable mini-app, without coding or server setup.

Example: “Create a voting app for today's workshop, with five candidates and live results.”

**Describe → Generate → Share → Use → Close**

Participants join through a link or QR code. The host views shared results and closes the app when the activity ends. Future extensions include remixing an app and automatic expiry.

## Build direction

MinintApp fits [AI-Native Products & Operations](https://codexhackathon.sea.com/): AI turns a user's request into the app's inputs, interactions, and result views.

## MVP and technology

The target MVP is one complete voting flow: generate an app, share it, collect votes, show live results, and close voting.

- **Foundation:** Next.js, React, and TypeScript.
- **Planned AI layer:** Convert prompts into a validated application specification, rendered with supported UI blocks.
- **Planned data layer:** Supabase Postgres and Realtime, with server-side access and voting rules.

## How we use Codex

Codex assists with project setup and documentation. For the remaining build, we plan to use it for app specifications, APIs, UI, and tests through small, clearly defined tasks. Team members review changes and run relevant checks.

## Current status

The repository contains the application scaffold, landing page, health endpoint, development scripts, test definitions, and CI configuration. Generation, voting, QR sharing, and realtime features remain to be implemented.

This is a draft. Final feature results and the demo link will be added before converting the write-up to PDF.
