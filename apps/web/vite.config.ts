import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const sha256Src = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../packages/sha256/src/index.ts',
);
const licenseSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../packages/license/src/index.ts',
);

// verbatimModuleSyntax must stay off (unset) in tsconfig.json: TanStack Start's docs warn it can
// leak server-only code into the client bundle.
//
// This is the config used for local dev, a plain `pnpm build`, and tests - TanStack Start's
// normal SSR-capable build, basepath "/". The GitHub Pages static-SPA build is a deliberately
// separate config file, not a branch in this one - see ./vite.gh-pages.config.ts and
// .github/workflows/gh-pages.yml.
export default defineConfig(({ command }) => ({
  // Port 5000 (Vite's previous choice here) collides with macOS's AirPlay Receiver
  // (ControlCenter), which also listens on 5000/7000 by default. Vite ends up bound only on the
  // IPv6 loopback ([::1]:5000) while ControlCenter holds the IPv4 wildcard - a browser hitting
  // `localhost`/`127.0.0.1` resolves to ControlCenter's HTTP endpoint instead, which returns a
  // plain 403 that has nothing to do with this app. 5173 is Vite's own upstream default and isn't
  // claimed by any macOS system service.
  server: { port: 5173 },
  resolve: {
    tsconfigPaths: true,
    // Dev only: resolve @mtlic/sha256 and @mtlic/license straight to source so editing
    // either package hot-reloads immediately, with no separate `tsdown --watch` process and no
    // stale dist/ build. Production build intentionally uses the real, built dist/ output instead
    // — see ./docs/ARCHITECTURE.md.
    alias: command === 'serve' ? { '@mtlic/sha256': sha256Src, '@mtlic/license': licenseSrc } : {},
  },
  plugins: [
    tanstackStart(), // must precede viteReact() in this array
    viteReact(),
    tailwindcss(),
  ],
  test: {
    // apps/web has no test files yet (the domain logic that would otherwise need UI-level tests
    // lives in packages/sha256 and packages/license, both fully covered there instead) - without
    // this, vitest run exits 1 on zero matched test files, which would make `pnpm -r run test`
    // fail here even though nothing is actually broken.
    passWithNoTests: true,
  },
}));
