# Approach
- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

# Project
- pnpm monorepo (Turborepo): `apps/api` (NestJS + Prisma + PostgreSQL + Redis), `apps/web` (Next.js), `packages/sdk` (TypeScript SDK).
- Commands: `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm db:migrate`, `pnpm db:studio`.

# Override
User instructions always take precedence over the rules above.
