# JiraFlow Project Planning

Planning artifacts for the JiraFlow v1 TypeScript rewrite.

## Source of truth

1. Product: `docs/product/v1-product-spec.md`
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

Decision records here are the working set used by implementation plans. Applicable
architecture records are published under `docs/adr/`, including accepted
ADR-0009. Durable early implementation decisions are under `docs/decisions/`;
milestone and execution records remain with their plans here.

## Active plans

- [VS-0 / VS-1 Architecture Validation and Vertical Slice](./plans/vs-0-vs-1-vertical-slice.md) (complete; architecture-frozen)
- [M2 Core Engine residual](./plans/m2-core-engine.md) (complete; hardened)
- [Residual v1 roadmap E8-E14](./plans/v1-residual-e8-e14.md) (complete locally;
  remote release gates recorded)
