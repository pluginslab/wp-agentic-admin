# 001 — Progress + deviations

## Deviations from plan.md

### No PHPUnit tests (Phase 1, 2, 3, 4)

The plan called for PHPUnit tests under `tests/php/`. The project ships zero PHPUnit infrastructure (composer.json has only WPCS dev deps; `tests/` contains Jest suites only). Adding PHPUnit + a WP test bootstrap is meaningful scope creep for this feature.

**Decision:** Skip PHPUnit. Verification rests on:
- WPCS lint catching obvious mistakes
- Manual smoke tests against the local docker stack documented in Phase 7
- Lightweight script-style PHP harnesses under `tests/php-manual/` only if a class becomes too complex to verify by curl

Revisit if a follow-up feature warrants standing up real PHPUnit.

## Phase progress

- **Phase 0** — branch + plan commit — ✅ done (commit `39b7f98`)
- **Phase 1** — Settings — in progress
- ...
