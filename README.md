# JiraFlow

Link git commits with Jira issues.

> **This branch (`rewrite/v1`) is the v1 TypeScript rewrite.**
> It is an unpublished development line. The stable npm `latest` release
> remains the Go-based `jira-flow@0.5.0` until v1 reaches stable `1.0.0`.
> Nothing on this branch is published to npm.

## Status

v1 is in vertical-slice development. The currently supported surface on this
branch is:

```text
jira-flow --help
jira-flow --version
jira-flow init --yes
jira-flow status
jira-flow doctor
jira-flow                  # minimal OpenTUI repository overview
jira-flow hook commit-msg <file>   # internal, powers the Git integration
```

## Development

Requirements:

- [Bun](https://bun.sh) 1.3+
- Git 2.39+ (`--path-format=absolute` support)

```bash
bun install
bun run typecheck
bun run lint
bun test
bun run build        # compiles dist/jira-flow standalone binary
```

Run from source:

```bash
bun run src/main.ts --help
```

Run the compiled binary:

```bash
./dist/jira-flow --version
```

## Documentation

- Product specification: `docs/product/v1-product-spec.md`
- Technical architecture: `docs/architecture/v1-technical-architecture.md`
- Implementation roadmap: `docs/planning/v1-implementation-roadmap.md`
- Accepted decision records: `docs/adr/`, `docs/decisions/`

## Legacy Go implementation

The Go 0.5.0 implementation is preserved in Git history, the `v0.5.0` tag, and
the `legacy/go-v0.5` branch. It is not present on this branch.
