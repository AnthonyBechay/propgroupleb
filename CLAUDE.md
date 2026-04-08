# PropGroup - Claude Code Instructions

## Testing & Verification
- Do NOT run dev servers or preview locally unless explicitly asked
- Do NOT run tests unless explicitly asked
- Verify changes compile with `pnpm --filter web run build` when making significant changes

## Project Overview
- Monorepo: `apps/web` (Next.js frontend), `apps/backend` (Express API)
- Database: PostgreSQL with Prisma ORM (`packages/db`)
- UI: Tailwind CSS v4 + shadcn/ui components
- Auth: JWT cookies (httpOnly) + Google OAuth
- Focus: Georgia real estate investment platform

## Key Conventions
- Color palette: `#1B3A5C` (primary navy), `#C49A2E` (accent gold), slate neutrals
- CSS variables use bare HSL triples in `:root`, wrapped with `hsl()` in `@theme inline` block
- Use `pg-` prefixed utility classes from `design-system.css` where available
- Portal has its own sidebar layout (separate from main site navbar)
- Admin has its own layout with sidebar + header
