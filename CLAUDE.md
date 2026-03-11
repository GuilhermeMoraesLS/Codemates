# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (`apps/web/`)
```bash
cd apps/web
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Production build
npm run l+int     # ESLint (flat config v9)
```

### Backend (`apps/server/`)
```bash
# Activate venv (Windows)
.venv/Scripts/activate

# Run FastAPI server (localhost:8000)
.venv/Scripts/python -m uvicorn apps.server.main:app --reload --app-dir .

# Or from apps/server/
cd apps/server
python -m uvicorn main:app --reload
```

### Environment
- Root `.env` is the single source of truth for all secrets
- `apps/web/.env.local` holds public Next.js vars (`NEXT_PUBLIC_*`)
- Backend reads root `.env` via `../../../.env` relative path from `apps/server/core/config.py`

## Architecture

### Monorepo Layout
```
apps/web/     → Next.js 16 + React 19, TypeScript, Tailwind CSS v4, App Router
apps/server/  → Python 3.11+, FastAPI, Agno agents
docs/         → Brand guide, DB migrations
```

### Frontend (`apps/web/`)
- **Auth flow**: GitHub OAuth → `/api/auth/callback` (Next.js route) → exchanges code → sets Supabase session → redirects to `/dashboard`
- **Supabase SSR**: client initialized in `lib/supabase.ts`, used server-side and client-side
- **API calls**: `lib/api.ts` wraps backend calls to `localhost:8000`
- **Styles**: Tailwind v4 with PostCSS. Global CSS in `app/globals.css`. Path alias `@/*` resolves to repo root of `apps/web/`

### Backend (`apps/server/`)
- **Entry**: `main.py` — mounts routers, adds CORS for `localhost:3000`, schedules weekly mission generation
- **Routers**: `api/auth.py`, `api/users.py`, `api/groups.py`, `api/missions.py`
- **Agents** (Agno framework):
  - `mission_agent.py` — generates individual & collective missions via LLM
  - `profile_agent.py` — analyzes GitHub user profiles
  - `verification_agent.py` — verifies commit diffs against mission criteria
- **Scheduled job**: runs every Sunday 08:00 UTC via APScheduler → calls `mission_agent` for all active groups
- **Tools**: `tools/github_tool.py` — GitHub API interactions used by agents
- **MCP**: FastMCP with SSE transport in `mcp/`
- **Config**: Pydantic Settings in `core/config.py`; Supabase client in `core/supabase_client.py`

### Database
- Supabase (PostgreSQL) — schema in `docs/migrations.sql`
- Auth handled by Supabase + GitHub OAuth

## Key Domain Concepts
- **Missões**: weekly missions, individual (per user profile) or collective (group collaboration)
- **Streak**: weekly streak with 1 shield/month; logic in `core/streak.py`
- **Grupos**: 3–7 members, admin-only invites (7-day expiry)
- **Pontos/nível**: commit scoring based on % of relevant files; levels: INICIANTE → DEV → ENGENHEIRO → SÊNIOR → ARQUITETO
- **Verificação**: agents analyze commit diffs to validate mission completion

## Brand / Design System
- Dark theme: `bg #0A0E1A`, surface `#151C30`, border `#1E2D4A`
- Accent colors: Terminal Green `#00FF94`, Cyber Cyan `#00D4FF`, Code Purple `#8B5CF6`
- Fonts: JetBrains Mono (headings, logo, code) + Space Grotesk (body)
- Full guide: `docs/codemates-brand.html`

## Agno Agent Patterns
```python
from agno.agent import Agent
from agno.models.openai import OpenAIChat

agent = Agent(model=OpenAIChat(id="gpt-4o"), tools=[...])
response = agent.run(prompt, stream=False)
result = response.content
```
- Tools extend `agno.tools.Toolkit`, register methods with `self.register()`
- MCP tools use `@mcp_server.tool()` decorator
