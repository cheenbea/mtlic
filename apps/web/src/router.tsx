import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

// Named getRouter(), not createRouter(): @tanstack/start-client-core's hydration entry imports
// this specific name from the "#tanstack-router-entry" virtual module. TanStack Start is still
// pre-1.0 (RC) and this convention has changed between doc revisions and installed versions.
export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
