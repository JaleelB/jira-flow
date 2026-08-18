# 0011 — Canonicalize v1 Docs Into This Repository

## Status

Accepted

## Context

The implementation agent was instructed to treat in-repo paths as authoritative:

- `docs/product/v1-product-spec.md`
- `docs/architecture/v1-technical-architecture.md`
- `docs/planning/v1-implementation-roadmap.md`
- `docs/reviews/v0.5.0-review.md`
- `docs/product/product-direction.md`
- `docs/product/product-journey.md`

Those files do not exist in `jira-flow`. They currently live in the sibling repo `/home/jaleelbdev/Repos/docs` under different filenames. Roadmap E14-5 also requires committing these docs.

A rewrite branch that does not contain the specs cannot be handed to an implementation agent cleanly.

## Decision

During VS-0, copy the authoritative documents into this repository at the canonical paths above, using the sibling-repo content as the source.

Do not edit product/architecture/roadmap content while copying except to set the filenames. Do not treat the sibling repo as a runtime dependency after the copy.

Published ADRs under `docs/adr/` remain an E14 task; working decisions stay in `.project-planning/decisions/` until then.

## Alternatives Considered

- Leave docs in the sibling repo and reference them by absolute path — rejected; rewrite/v1 must be self-contained
- Rewrite/summarize the specs into `.project-planning/` only — rejected; the user named `docs/` paths as authoritative

## Consequences

VS-0 includes a docs import commit. If the sibling copies drift later, the in-repo files win for this repository.

## Related Files

- `docs/product/`
- `docs/architecture/`
- `docs/planning/`
- `docs/reviews/`

## Related Plan

- `.project-planning/plans/vs-0-vs-1-vertical-slice.md`

## Supersedes

None

## Superseded By

None

## Notes

This is a repository layout decision, not a product redesign.
