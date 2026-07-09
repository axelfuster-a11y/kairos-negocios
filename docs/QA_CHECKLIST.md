# QA Checklist

Use this checklist for PRs. Mark not applicable items clearly.

## Local Commands

```bash
node tools/run-static-checks.mjs
git diff --check
```

## Functionality

- App loads without console `ReferenceError`.
- Login, logout, and session-dependent screens still behave as expected.
- Main modules open: Inicio, Productos, Ventas, Finanzas, Equipo.
- Mas herramientas opens.
- Asesor IA opens.
- Affected buttons, forms, modals, and filters work.
- Critical writes still use preview and confirmation.

## Mobile and Desktop

- Check one mobile viewport and one desktop viewport.
- Check tablet/mobile navigation for Inicio, Productos, Ventas and Finanzas.
- Text fits inside buttons, cards, tables, and modals.
- Navigation remains usable.
- Important alerts and primary actions are visible.
- No incoherent overlap between UI elements.

## Finance, Stock, and Sales Calculations

- Income, expenses, profit, margin, fixed costs, team payments, and withdrawals keep their meaning.
- Sales update totals, cost, profit, and stock only when confirmed.
- Stock changes do not create negative or invented values unless explicitly allowed.
- Import, edit, delete, and duplicate-prevention rules still hold.
- Labels do not overstate precision, especially cash or available money.

## Supabase and RLS

- No existing migration is edited without approval.
- New migrations are ordered and documented.
- RLS remains enabled where user data exists.
- Queries and RPCs enforce `user_id` ownership.
- Critical multi-table writes are transactional.
- Failed actions do not leave partial data.

## Security

- No service role keys, API secrets, tokens, or private credentials are committed.
- Frontend only contains public-safe configuration.
- External integrations use secure backend/OAuth patterns.
- User-provided text is escaped before rendering as HTML.
- Auth-dependent actions require an authenticated user.

## AI Behavior

- The AI advisor does not invent price, cost, stock, quantity, payment type, or amount.
- The AI asks for missing critical data.
- The AI does not claim it saved, changed, sold, paid, or deleted anything unless confirmation succeeded.
- Bot actions preserve preview, confirmation, audit trail, and failure handling.
- Fallback responses are clearly non-executing guidance.

## Documentation

- README, handoff, architecture notes, Supabase notes, and QA docs are updated when behavior changes.
- CHANGELOG.md is updated for user-facing module, navigation, data-display, or QA changes.
- PR explains what changed and what did not change.
- Manual QA notes include tested screens and known gaps.
