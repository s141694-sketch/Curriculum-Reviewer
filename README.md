# Curriculum Reviewer

An AI-assisted curriculum design tool. Describe a subject, level, learning goals, and
duration, and Claude drafts a structured course outline (modules, objectives, topics)
that you can then edit directly.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Claude API via `@anthropic-ai/sdk`
- Curricula are persisted to `localStorage` (no backend database yet — see below)

## Getting started

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

- `/` — lists curricula saved in the browser
- `/curriculum/new` — enter a subject/level/goals/duration and generate a draft with AI,
  or start blank
- `/curriculum/[id]` — edit modules and topics inline
- `POST /api/generate` — server route that calls Claude and returns a structured
  module/topic outline as JSON

## Notes / next steps

- Persistence is client-side (`localStorage`) for now. Swap `src/lib/storage.ts` for a
  real database (e.g. Postgres via Prisma, or Supabase) once you need multi-device or
  multi-user access.
- There's no auth yet — everything is local to the browser.
- `src/app/api/generate/route.ts` is the only place that talks to the Claude API; adjust
  the system prompt there to change how outlines are generated.
