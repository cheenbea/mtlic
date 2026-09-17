# mtlic

MikroTik License Generator — a browser-based tool for building and signing MikroTik RouterOS and
RouterOS CHR license files, plus the pure-TS crypto/domain packages it's built on.

**Live app:** https://cheenbea.github.io/mtlic/

## Structure

Each package/app documents itself in its own `docs/` folder — there is no shared top-level `docs/`.

- `apps/web` — the license generator UI (TanStack Start + React)
  - [`apps/web/docs/ARCHITECTURE.md`](./apps/web/docs/ARCHITECTURE.md), [`DESIGN.md`](./apps/web/docs/DESIGN.md), [`STYLING.md`](./apps/web/docs/STYLING.md)
- `packages/license` (`@mtlic/license`) — license building/signing, KCDSA, System-ID/Software-ID codecs
  - [`packages/license/docs/DESIGN.md`](./packages/license/docs/DESIGN.md), [`API.md`](./packages/license/docs/API.md)
- `packages/sha256` (`@mtlic/sha256`) — a customizable SHA-256 engine (generic, not MikroTik-specific)
  - [`packages/sha256/docs/DESIGN.md`](./packages/sha256/docs/DESIGN.md), [`API.md`](./packages/sha256/docs/API.md)

## Install

```bash
pnpm install
```

## Develop

```bash
pnpm --filter @mtlic/web dev
```

## Build / Test / Lint

```bash
pnpm -r run build
pnpm -r run test
pnpm run lint
```

## Deployment

The live app above is `apps/web` built as a static SPA and published to the `gh-pages` branch by
`.github/workflows/gh-pages.yml`. See
[`apps/web/docs/ARCHITECTURE.md`](./apps/web/docs/ARCHITECTURE.md#github-pages-deployment-spa-build)
for how that build differs from the normal SSR build, and how/when the workflow runs.

## License

[MIT](LICENSE)
