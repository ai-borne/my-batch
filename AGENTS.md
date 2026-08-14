# Ajinkyans Agent Development Rules

These rules apply to all work in this repository.

## Rule 1 — Think Before Coding

State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what’s unclear.

## Rule 2 — Simplicity First

Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

## Rule 3 — Surgical Changes

Touch only what you must. Clean up only your own mess.
Don’t “improve” adjacent code, comments, or formatting.
Don’t refactor what isn’t broken. Match existing style.

## Rule 4 — Goal-Driven Execution

Define success criteria. Loop until verified.
Don’t follow steps. Define success and iterate.
Strong success criteria let you loop independently.

## Rule 5 — Use the model only for judgment calls

Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

## Rule 6 — Token budgets are not advisory

Per-task: 4,000 tokens. Per-session: 30,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

## Rule 7 — Surface conflicts, don’t average them

If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don’t blend conflicting patterns.

## Rule 8 — Read before you write

Before adding code, read exports, immediate callers, shared utilities.
“Looks orthogonal” is dangerous. If unsure why code is structured a way, ask.

## Rule 9 — Tests verify intent, not just behavior

Tests must encode WHY behavior matters, not just WHAT it does.
A test that can’t fail when business logic changes is wrong.

## Rule 10 — Checkpoint after every significant step

Summarize what was done, what’s verified, and what’s left.
Don’t continue from a state you can’t describe back.
If you lose track, stop and restate.

## Rule 11 — Match the codebase’s conventions, even if you disagree

Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don’t fork silently.

## Rule 12 — Fail loud

“Completed” is wrong if anything was skipped silently.
“Tests pass” is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.

## Strict Development Rules

As we execute this plan, adhere to these constraints at all times:

1. **Phase Independence & Success:** Every phase must end with a fully successful build. Do not proceed to the next phase if the current build is failing.
2. **Test-Driven Development (TDD):** Write tests (unit and integration) before or alongside implementation. 100% of tests must pass before a phase is marked complete.
3. **Architecture & Clean Code:** Strictly uphold MVVM, SOLID, DRY, and SSOT (Single Source of Truth) principles.
   - Hard limit: no file may exceed 300 lines of code, unless required by SRP. If so, comments must explain why the file should not be split; otherwise split the file under 300 lines.
4. **Resource Management:** Never hardcode strings or colors. Use string resources and the established universal color scheme to prevent UI/UX technical debt.
5. **Cybersecurity:** Keep the codebase secure. Actively prevent and check for security vulnerabilities in every addition or update.

## Phase Handoff Protocol

At the end of every phase, before moving to the next, pause and provide a Phase Summary containing:

1. What technical debt was incurred during the phase.
2. The exact steps taken to immediately and fully resolve it, with no skipping or delaying technical debt.
3. Confirmation that the build succeeds and all tests pass.

Only after resolving all debt and verifying tests may work proceed to the next phase.

