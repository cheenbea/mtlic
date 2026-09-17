# Styling conventions

This app styles with Tailwind CSS v4 (CSS-first `@theme`, see `src/styles/app.css`) plus two
component-layer tools that solve different problems — they aren't alternatives to pick between,
they compose.

## `react-twc` — single-element, prop-driven styling

Use `twx` (this app's `createTwc({ compose: cn })` instance from `src/lib/cn.ts`, not the bare
`twc` default export) when one element's classes vary based on its own props:

```ts
const Button = twx.button.transientProps(['primary'])<{ primary?: boolean }>((props) => [
  'rounded-md px-4 py-2 text-sm font-medium transition-colors',
  props.primary ? 'bg-cta-bg text-cta-fg' : 'border border-panel-border bg-panel text-strong',
]);
```

`.transientProps(['primary'])` matters: without it, `primary` would leak onto the rendered
`<button>` as an unrecognized DOM attribute. Composing with our shared `cn` (not react-twc's
default merge) keeps class-conflict resolution consistent with every other merge call in the app.

**Weakness:** no concept of sibling elements sharing one variant state — a label+input+error
group forced into separate `twc()` primitives means re-deriving "is this invalid?" once per
element.

## `tailwind-variants` slots — multi-part components with shared state

Use `tv({ slots, variants })` when several sibling elements must react to the _same_ state
together. This page's field pattern (private key, systemId) is the concrete example — one
`invalid` variant recolors both the input border and the error text from a single judgment:

```ts
const fieldStyles = tv({
  slots: { base: '...', label: '...', input: '...', error: '...' },
  variants: {
    invalid: {
      true: { input: 'border-danger' },
      false: { input: 'border-panel-border' },
    },
  },
});
const styles = fieldStyles({ invalid: !field.state.meta.isValid });
// styles.input(), styles.error(), ... — one source of truth, not duplicated per element.
```

**Weakness:** `tv()` returns class-string functions, not components — it answers "what classes,"
not "what reusable element," so it's typically consumed inside hand-written JSX or fed into a
`twc()`-created element, not used standalone.

## Rule of thumb

Single element, own props → `react-twc`. Multiple elements, one shared judgment → `tailwind-variants` slots.
