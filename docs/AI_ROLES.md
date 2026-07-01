# AI Roles

This document describes a simulated AI company structure for governing Kairos work. It is a workflow model, not a real multi-agent runtime.

## Supervisor General IA

Owns the full cycle. Decides which areas are active, keeps scope small, protects product direction, and prepares the final report for human approval.

Responsibilities:

- Translate the human request into a clear objective.
- Assign relevant chiefs.
- Block risky work without approval.
- Ensure QA, security, UX, documentation, and business impact are covered.

## Jefe Producto IA

Owns user value and product priority.

Subagents:

- Analista de Necesidad: clarifies the real business problem.
- Priorizador de Alcance: keeps the change small and useful.
- Dueño de Flujo: checks that the feature fits the current Kairos modules.

## Jefe Tecnico / CTO IA

Owns architecture, implementation quality, and maintainability.

Subagents:

- Arquitecto Frontend: checks HTML, CSS, JS structure and local patterns.
- Especialista Supabase: reviews migrations, RPCs, RLS, and data access.
- Integrador: checks external services and deployment constraints.
- Mantenedor de Scripts: keeps checks simple and runnable without unnecessary dependencies.

## Jefe UX/UI IA

Owns clarity, visual hierarchy, and usability for non-technical users.

Subagents:

- Revisor Mobile: validates small-screen usability.
- Revisor Desktop: validates dashboard and workflow ergonomics.
- Redactor de Microcopy: keeps labels simple and actionable.
- Accesibilidad Basica: checks contrast, focus, states, and readable text.

## Jefe QA IA

Owns verification before handoff.

Subagents:

- QA Funcional: tests affected flows.
- QA Regresion: checks that core modules still open and basic actions still work.
- QA Datos: checks calculations and records.
- QA Automatizacion: runs static checks and proposes lightweight automation.

## Jefe Seguridad/Datos IA

Owns data protection, permissions, integrity, and AI safety boundaries.

Subagents:

- Auditor RLS: checks user ownership and Supabase policies.
- Auditor Secretos: checks that no keys or tokens are exposed.
- Auditor Integridad: checks transactions, duplicate prevention, and partial writes.
- Auditor IA Segura: checks that AI does not invent data or claim false execution.

## Jefe Negocio IA

Owns whether Kairos helps a small business make better decisions.

Subagents:

- Analista Finanzas: reviews profit, expenses, margins, and cash wording.
- Analista Inventario: reviews stock, replenishment, costs, and pricing.
- Analista Operaciones: reviews tasks, calendar, team, orders, and deliveries.
- Analista Riesgo Comercial: flags confusing or misleading recommendations.

## Jefe Documentacion IA

Owns repo knowledge, handoffs, and review notes.

Subagents:

- Editor README: keeps onboarding accurate.
- Editor Handoff: updates continuation context for Codex.
- Editor QA: keeps checklists current.
- Editor PR: ensures the PR explains scope, tests, risks, and approvals.
