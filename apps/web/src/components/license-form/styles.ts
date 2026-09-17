// Shared style primitives for the license form: the `Button` component and `fieldStyles` variant
// set are both used from more than one field/control file (formControls.tsx and
// PrivateKeyField.tsx), so they live here instead of being duplicated or arbitrarily owned by
// whichever consumer happened to need them first.
import { tv, twx } from '../../lib/cn';
import type { TwcComponentProps } from 'react-twc';

export type ButtonProps = TwcComponentProps<'button'> & { primary?: boolean };

// Only primary/CTA is a flat "border matches own fill" block (border-cta-bg on bg-cta-bg) - this
// one deliberately references --color-cta-bg directly, not --color-accent, because its job is
// specifically "match my own fill", which happens to use the same purple as the page's general
// interactive-attention color today but is a different concern that could diverge later. Every
// non-primary button (the Software ID/System ID switch in both states, Copy, and any future one) gets
// a real, visible border-panel-border at rest, and a hover:border-accent/50 cue - --color-accent
// IS this purple now (see app.css), so this is the semantically-correct token for "the page's
// general interactive-attention color", distinct from --color-cta-bg's narrower "CTA fill" role
// even though they currently resolve to the same value. Primary doesn't get a separate
// `hover:border-*` class at all: its resting border is already border-cta-bg (same as its own
// fill), and `hover:brightness-110` already lightens that border along with the rest of the
// element - still a purple-hued border on hover, just reached via the existing brightness filter
// rather than a second, redundant color utility that would fight with it.
export const Button = twx.button.transientProps(['primary'])<ButtonProps>((props) => [
  'rounded-control border px-3 py-1.5 text-input font-medium transition-colors duration-(--motion-hover) disabled:cursor-not-allowed disabled:opacity-40',
  props.primary
    ? 'border-cta-bg bg-cta-bg text-cta-fg hover:brightness-110'
    : 'border-panel-border bg-panel text-strong hover:border-accent/50',
]);

// Shared classes for the license/level/features/days fields below, which all render as a single
// `<label>Text <input/select .../></label>` line (an inline control next to its own label text)
// rather than fieldStyles' own block layout (its own line, `mt-1` gap, under-input error message)
// used by System/Software ID and the private key. Previously duplicated verbatim across the level
// select, license-type select, features number input, and days number input in ./formControls.tsx
// - centralized here for the same reason fieldStyles itself is: more than one consumer needs it.
export const inlineSelectClass =
  'ml-2 rounded-control border border-panel-border bg-panel px-2.5 py-1.5 text-input text-strong outline-none transition-colors duration-(--motion-hover) focus:border-accent/50';
export const inlineNumberClass =
  'ml-2 w-20 rounded-control border border-panel-border bg-panel px-2.5 py-1.5 font-mono text-input text-strong outline-none transition-colors duration-(--motion-hover) focus:border-accent/50 disabled:cursor-not-allowed disabled:opacity-50';
export const inlineErrorClass = 'ml-2 text-label text-danger';

export const fieldStyles = tv({
  slots: {
    base: 'mb-4 flex flex-col gap-1',
    label: 'text-label text-soft',
    input:
      'w-full rounded-control border bg-panel px-2.5 py-1.5 font-mono text-input text-strong outline-none transition-colors duration-(--motion-hover) focus:border-accent/50',
    error: 'text-label text-danger',
  },
  variants: {
    invalid: {
      true: { input: 'border-danger' },
      false: { input: 'border-panel-border' },
    },
  },
  defaultVariants: {
    invalid: false,
  },
});
