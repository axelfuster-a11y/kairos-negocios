# Kairos AI Agent Rules

This repo is managed through small, reviewable AI-assisted cycles. Codex and any other AI agent must treat Kairos as a business-critical app for non-technical users.

## Read First

Before proposing or changing code, read:

1. `README.md`
2. `CODEX_HANDOFF.md`
3. `ARCHITECTURE_AUDIT.md`
4. `SUPABASE_SCHEMA_NOTES.md`
5. `QA_FINANCE_SERVICE.md`

For Supabase or data changes, also read `supabase/README.md` and the relevant migration files.

## Operating Rules

- Work from a dedicated branch and open a PR for review.
- Keep changes small and scoped to the approved objective.
- Do not rewrite the app, change framework, or add a build system unless explicitly approved.
- Do not modify app logic, finance, stock, sales, AI advisor behavior, Supabase, or migrations unless the task explicitly approves it.
- Do not edit already-applied migrations. Add a new migration only with human approval.
- Do not expose secrets, tokens, service keys, or AI provider credentials in frontend code.
- Keep critical actions behind preview and human confirmation.
- Never make the AI advisor claim it executed an action unless the app actually confirmed it.
- Do not invent critical business data such as price, cost, stock, amount, payment type, or quantity.

## Required Local Checks

Run before handing off changes:

```bash
node tools/run-static-checks.mjs
git diff --check
```

If UI, data, Supabase, or AI behavior changes, add manual QA notes in the PR.

## Human Approval Required

Ask before touching:

- Supabase migrations, RLS, RPCs, tables, policies, or data backfills.
- Finance, sales, stock, imports, team payments, owner withdrawals, or profit calculations.
- `ai-advisor`, bot action confirmation, prompts, models, or AI execution behavior.
- Authentication, security boundaries, secrets, or integrations.
- WhatsApp, Mercado Libre, Shopify, Tienda Nube, Mercado Pago, or other external channels.
- Large refactors, dependency changes, framework changes, deploy settings, or merges to `main`.
