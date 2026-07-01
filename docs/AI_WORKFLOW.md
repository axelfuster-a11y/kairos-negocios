# AI Workflow

Kairos uses GitHub and Codex in controlled cycles. The goal is not to move fast blindly; it is to make small improvements that a human can understand, test, approve, and revert.

## Cycle

1. Objective
   - Define the business outcome in plain language.
   - State what is out of scope.

2. Diagnosis
   - Read the required project docs.
   - Inspect the relevant files before proposing changes.
   - Identify current behavior, risks, tests, and unknowns.

3. Area Activation
   - Supervisor General IA selects the relevant AI chiefs from `docs/AI_ROLES.md`.
   - Only activate areas needed for the objective.

4. Proposal
   - Describe the smallest useful change.
   - List touched files, risks, checks, and approvals needed.
   - Wait for human approval when the change touches protected areas.

5. Implementation
   - Create or use a dedicated branch.
   - Make small commits or small reviewable diffs.
   - Follow existing code style and repo constraints.

6. QA
   - Run local commands.
   - Validate the affected user flows.
   - Record manual checks and unresolved gaps.

7. Security and Data Review
   - Check secrets, auth, RLS, ownership, and data integrity.
   - Confirm the AI does not invent critical business data.
   - Confirm critical writes require preview and confirmation.

8. UX Review
   - Check desktop and mobile.
   - Confirm the screen stays understandable for non-technical business owners.
   - Avoid unclear labels, hidden critical states, or visual noise.

9. Documentation
   - Update docs when behavior, workflow, data model, or QA expectations change.
   - Keep handoff notes current for the next AI cycle.

10. Final Report
   - Summarize what changed and what did not change.
   - List files touched, checks run, risks, and recommended next step.

11. Human Approval
   - A human reviews the PR.
   - Protected areas require explicit approval before merge or deploy.

## Default Branch Naming

Use descriptive branches. For governance work:

```bash
ai-governance-workflow
```

For feature work, prefer:

```text
feature/<short-name>
fix/<short-name>
docs/<short-name>
refactor/<short-name>
```
