import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages-only build config, kept as its own file rather than a runtime branch inside
// ./vite.config.ts - see .github/workflows/gh-pages.yml, which copies this file over
// vite.config.ts before running `pnpm --filter @mtlic/web run build` and never runs it any other
// way (not used for local dev, a plain `pnpm build`, or tests).
//
// GitHub Pages is a pure static host - a project page served under /mtlic/, not the domain root -
// with no server runtime to do TanStack Start's normal SSR/prerender-shell rewrite. This build
// therefore:
//  - enables TanStack Start's SPA mode, which prerenders a static shell
//    (dist/client/_shell.html) instead of requiring a server at request time (see
//    https://tanstack.com/start/latest/docs/framework/react/guide/spa-mode); and
//  - points the router basepath and Vite's asset base at /mtlic/, matching this repo's GitHub
//    Pages project-page URL (https://cheenbea.github.io/mtlic/).
//
// No dev-only source aliasing, dev server port, or vitest config is needed here - none of those
// apply to a one-shot CI build.
const ghPagesBasepath = '/mtlic';

export default defineConfig({
  base: `${ghPagesBasepath}/`,
  resolve: {
    // Same setting as ./vite.config.ts's non-dev-serve behavior: resolves @mtlic/sha256 and
    // @mtlic/license to their real, built dist/ output, not raw source - this build has no `vite
    // dev` equivalent, so the dev-only source alias from vite.config.ts is intentionally omitted.
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({ spa: { enabled: true }, router: { basepath: ghPagesBasepath } }), // must precede viteReact() in this array
    viteReact(),
    tailwindcss(),
  ],
});
