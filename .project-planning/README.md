# JiraFlow Project Planning

Planning artifacts for the JiraFlow v1 TypeScript rewrite.

## Source of truth

1. Product: `docs/product/v1-product-spec.md` (currently lives in the sibling `docs` repo; see contradictions in the VS-0/VS-1 plan)
2. Architecture: `docs/architecture/v1-technical-architecture.md`
3. Roadmap: `docs/planning/v1-implementation-roadmap.md`
4. Accepted decisions in `decisions/`
5. Derived implementation plans in `plans/`

## Layout

```text
.project-planning/
  README.md
  decisions/
  plans/
  sessions/
```

Decision records here are the working set used by implementation plans. Applicable records (ADR-0001–0008, DR-0010–0016) are also published as durable repository records under `docs/adr/` and `docs/decisions/` per the approved 2026-08-18 amendment. ADR-0009 stays in this working set until SPIKE-01 completes. Full architecture-doc publication (E14-5) remains a later task.

## Active plans

- [VS-0 / VS-1 Architecture Validation and Vertical Slice](./plans/vs-0-vs-1-vertical-slice.md) (complete; architecture-frozen)
- [M2 Core Engine residual](./plans/m2-core-engine.md)
