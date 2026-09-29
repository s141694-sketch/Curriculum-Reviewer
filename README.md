# Curriculum Reviewer

An AI-assisted curriculum design tool. Describe a subject, level, learning goals, and
duration, and Claude drafts a structured course outline (modules, objectives, topics)
that you can then edit directly.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS, Harak visual identity (see `src/app/globals.css`)
- AI drafts from an open-weights model through any OpenAI-compatible server
  (default: Qwen 2.5 on Ollama), or Claude via `@anthropic-ai/sdk` — see `src/lib/ai.ts`
- Name + role sign-in with a signed cookie; login log in `data/logins.json`
- Curricula are persisted to `localStorage` (no backend database yet — see below)

## Getting started

```bash
npm install
cp .env.example .env.local   # pick the AI provider and set the passcodes
npm run dev
```

### Open-source model (default)

```bash
ollama pull qwen2.5:14b      # or any model you prefer; set AI_MODEL to match
ollama serve                 # serves http://localhost:11434/v1
```

Any hosted OpenAI-compatible endpoint works too: set `AI_BASE_URL`, `AI_MODEL` and
`AI_API_KEY`. Set `AI_PROVIDER=anthropic` with `ANTHROPIC_API_KEY` to use Claude instead.

### Sign-in and roles

Every page asks for a name and a role first (`/login`). Members design curricula;
reviewers and admins also get `/admin`: the list of everyone who signed in, JSON
export/import of curricula, and (admins) the AI configuration. Elevated roles need a
passcode: `REVIEWER_PASSCODE` / `ADMIN_PASSCODE` in the environment (in development
they fall back to `reviewer` / `admin`; production refuses elevated sign-in until
they are set). Set `SESSION_SECRET` in production.

Open [http://localhost:3000](http://localhost:3000).

## How it works

- `/` — lists curricula saved in the browser
- `/curriculum/new` — enter a subject/level/goals/duration and generate a draft with AI,
  or start blank
- `/curriculum/[id]` — edit modules and topics inline
- `/login` — name and role sign-in; `/admin` — reviewer/admin panel
- `POST /api/generate` — server route that asks the configured model for a structured
  module/topic outline (in Arabic) as JSON
- `GET/POST/DELETE /api/session` — session cookie; `GET/DELETE /api/admin/users` — login log

## Notes / next steps

- Persistence is client-side (`localStorage`) for now. Swap `src/lib/storage.ts` for a
  real database (e.g. Postgres via Prisma, or Supabase) once you need multi-device or
  multi-user access.
- Sign-in is name + role with a passcode for elevated roles, not full user accounts.
  The login log is a JSON file, so it needs a persistent disk (not serverless).
- `src/app/api/generate/route.ts` holds the system prompt; `src/lib/ai.ts` holds the
  provider switch.
