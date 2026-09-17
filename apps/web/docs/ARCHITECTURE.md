# Architecture Notes

This file covers `apps/web`-specific build/tooling decisions. For the UI's own visual design
system, see [DESIGN.md](./DESIGN.md) and [STYLING.md](./STYLING.md) instead — this file is about
how the app is built, not how it looks.

## Dev vs. build resolution for `@mtlic/sha256`/`@mtlic/license`

`apps/web` depends on `@mtlic/sha256` and `@mtlic/license` through the workspace, which
normally resolve through their built `dist/` output. That's fine for `vite build`, but it creates
real gaps at other points in the lifecycle: a fresh checkout has no `dist/` at all until something
builds it; editing either package's `src/*.ts` while `vite dev` is running doesn't hot-reload,
because Vite doesn't watch `node_modules` (which is where the workspace symlink resolves through)
by default; and the editor's type-checking hits the same missing-`dist/` problem before a first
build.

`vite.config.ts` fixes the dev-time cases with a `resolve.alias` that only applies when
`command === 'serve'`, pointing both `@mtlic/sha256` and `@mtlic/license` straight at their
respective `src/index.ts` — so dev mode never touches `dist/` at all, edits hot-reload immediately,
and there's no separate `tsdown --watch` process to keep running for either package.
`tsconfig.json`'s `paths` entries do the same for the editor/type-checker. Production `vite build`
deliberately does _not_ use the alias — it resolves the real `dist/` output for both packages, so
the app ships (and CI would test) exactly what each package actually builds, not raw workspace
source. `package.json`'s `prebuild` hook (`pnpm --filter @mtlic/sha256 build && pnpm --filter
@mtlic/license build`) makes `pnpm --filter @mtlic/web build` correct on its own too, without
depending on the root's topologically-ordered `pnpm -r run build`.

## Why pinned to Vite 7, not 8

TanStack Start (still pre-1.0, RC) has open, unresolved bugs specifically on Vite 8/rolldown-vite
as of this writing: a production server that doesn't respond under Nitro v3 alpha, a React
Compiler config that changed shape, and dev-server crashes when paired with
`@vitejs/plugin-react-oxc`. `packages/sha256` and `packages/license` are unaffected either way —
neither depends on Vite; they build with Rolldown directly through `tsdown`. This app's own
`@vitejs/plugin-react` is pinned to the `^5` line for the same reason: `^6` moved its peer
dependency to `vite@^8` only.

Being on an RC framework also means the public docs don't always match the installed version —
`src/router.tsx` exports `getRouter()`, not the `createRouter()` shown in TanStack's own docs at
the time this was written, because the installed `@tanstack/start-client-core` imports that
specific name from its hydration entry. Expect this kind of drift to keep happening until TanStack
Start reaches a real 1.0.

## GitHub Pages deployment (SPA build)

The app normally runs as a server-rendered (SSR) TanStack Start app, which needs a Node.js/Nitro
server at request time. GitHub Pages is a pure static host with no server runtime, so it cannot
run that build at all — it needs a genuinely different one.

`vite.gh-pages.config.ts`, next to the normal `vite.config.ts`, is that different build. It is a
separate file rather than a runtime branch inside `vite.config.ts` on purpose, so the GitHub
Pages-only concerns never leak into local dev, a plain `pnpm build`, or tests. It differs from
`vite.config.ts` in exactly two ways:

- `tanstackStart({ spa: { enabled: true }, ... })` — TanStack Start's
  [SPA mode](https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode) prerenders a
  static shell (`dist/client/_shell.html`) at build time instead of requiring a server to render
  each request.
- `base` and `router.basepath` both set to `/mtlic` — this repo's GitHub Pages project-page URL is
  `https://cheenbea.github.io/mtlic/`, not the domain root, so every asset URL and route match
  needs that prefix.

`.github/workflows/gh-pages.yml` drives this build in CI: it copies `vite.gh-pages.config.ts` over
`vite.config.ts` before running `pnpm --filter @mtlic/web run build`, then promotes the resulting
SPA shell to both `index.html` and `404.html` (GitHub Pages can't rewrite arbitrary paths to an
SPA shell like a real server would) and adds a `.nojekyll` marker (GitHub Pages' Jekyll processing
otherwise ignores the underscore-prefixed `_shell.html` and its assets). The build output is then
pushed to the `gh-pages` branch, which GitHub Pages serves from directly.

The workflow runs on every push to `main` (and can also be started by hand via
`workflow_dispatch`), but the job targets a `gh-pages` GitHub Environment configured with a
required reviewer and a main-only deployment branch policy (set directly via the GitHub API/`gh`
CLI, not expressible in the workflow YAML itself) — so each run still pauses for one
"Review deployments → Approve and deploy" click before the build actually starts.
