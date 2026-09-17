/// <reference types="vite/client" />
import { createRootRoute } from '@tanstack/react-router';
import appCss from '../styles/app.css?url';
import { Root } from '../components/Root';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'MikroTik License Generator' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: Root,
});
