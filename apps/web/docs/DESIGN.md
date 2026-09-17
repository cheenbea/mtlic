# DESIGN.md

This is `apps/web`'s own design system reference — not a record of getdesign.md, the site that
inspired its initial direction. Every token and rule below is this project's own, current,
deliberate choice; where a value has since departed from getdesign.md's measured original, that
departure is called out explicitly rather than left implicit. The raw getdesign.md extraction this
document originally grew out of is kept outside this repository (scratch/reference material, not a
part of the project itself), so it's no longer linked from here — everything a reader needs is
this file's own content.

## Priority order, when choices conflict

1. **Correctness of what's rendered** — a license value, a form validation state — over any
   visual polish. This tool generates cryptographic license artifacts; getting the data right
   always outranks getting the pixel right.
2. **Consistency with an existing token/pattern** over introducing a new one-off value. If a need
   isn't served by the current token set, extend the set deliberately (see below) rather than
   reaching for an arbitrary value in one place.
3. **The accessibility baseline** (contrast, focus visibility) over a color or spacing choice that
   would look nicer but fail it. Every color pairing in this document was chosen or rejected
   against a computed WCAG ratio, not eyeballed.
4. **This project's own explicit decisions** over getdesign.md's measured original, whenever the
   two conflict. getdesign.md was a starting influence, not an authority this project continues to
   answer to.

## How to extend this system

1. Frame the need in terms of the token's _role_, not its pixel/hex value first ("a color for a
   secondary danger state", not "`#ff0000`").
2. Check whether an existing token already serves that role before defining a new one.
3. If a new token is genuinely needed, name it for its role (`--color-cta-bg`, `--radius-control`),
   never its raw value (`--purple-1`, `--radius-4px`) — even a token that currently equals
   another token's value stays separate if its _role_ is distinct (see "Same value, different
   role" below).
4. Verify contrast/legibility computationally before committing a color pairing, the way every
   pairing in this document already was — don't eyeball it.

## Color

Every color is a CSS custom property in `src/styles/app.css`'s `@theme` block (light, the
default/base) or its `.dark` / `[data-theme="dark"]` override block (dark — activated only by that
class/attribute, never by OS `prefers-color-scheme`; see "Rejected defaults").

| Token                  | Light     | Dark      | Role                                                                  |
| ---------------------- | --------- | --------- | --------------------------------------------------------------------- |
| `--color-bg`           | `#f4f4f5` | `#000000` | page background                                                       |
| `--color-panel`        | `#ffffff` | `#0a0a0a` | card/form panel fill, including the license output box                |
| `--color-border`       | `#e2e2e2` | `#242424` | outer/structural container borders                                    |
| `--color-panel-border` | `#eaeaea` | `#2a2a2a` | inner/control borders (inputs, selects, non-primary buttons)          |
| `--color-strong`       | `#171717` | `#ededed` | primary text, headings                                                |
| `--color-soft`         | `#666666` | `#a1a1a1` | secondary/label text                                                  |
| `--color-accent`       | `#793df9` | `#7c3aed` | general interactive-attention cue (hover + focus borders, everywhere) |
| `--color-cta-bg`       | `#793df9` | `#7c3aed` | primary/CTA button fill                                               |
| `--color-cta-fg`       | `#ffffff` | `#ffffff` | primary/CTA button text                                               |
| `--color-danger`       | `#b91c1c` | `#ff6b6b` | error/failure states                                                  |

**`--color-border` vs. `--color-panel-border` stay separate tokens** because they serve genuinely
different roles in this app's actual markup — `--color-border` wraps the outer form panel and the
license-output box; `--color-panel-border` outlines the controls living inside them. Not
duplicates of each other.

**Same value, different role:** `--color-accent` and `--color-cta-bg` currently resolve to the
identical hex in both themes. They stay two separate tokens on purpose — `--color-cta-bg`'s job is
"match the CTA button's own fill" (see "Button-state color philosophy"), while `--color-accent`'s
job is "the page's general interactive-attention color" (every hover/focus border outside the CTA
button itself). If a future rebrand wants a CTA color distinct from the general accent, only one
token needs to change. The same principle holds for `--radius-control` / `--radius-panel` (both
`0px` today, still separate) and `--text-input` / `--text-label` (both `10px` today, still
separate) — equal value is a coincidence of the current palette/scale, not a reason to collapse
two roles into one name.

## Typography

- `--font-sans`: `'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — all UI
  text and labels.
- `--font-mono`: `'Geist Mono', 'SFMono-Regular', Menlo, monospace` — the private key input, the
  System ID/Software ID input, and the license output textarea: anything holding literal
  hex/base64/cryptographic data reads as data, in a data-shaped font, not as prose.

### Size scale — even integers only, as a hard rule

| Token            | Size   | Role                                                                 |
| ---------------- | ------ | -------------------------------------------------------------------- |
| `--text-label`   | `10px` | field labels, hints, error/status text                               |
| `--text-input`   | `10px` | text typed/displayed inside inputs, selects, and the license output  |
| `--text-body`    | `12px` | body copy (not currently used by any element on this page; reserved) |
| `--text-heading` | `20px` | the page's `<h1>`                                                    |

Every size in this scale is, and must stay, an even number of pixels — a hard constraint applied
even when a measured or calculated "correct" value lands on an odd one: `--text-input` measured at
`13px` against the getdesign.md reference, and was originally rounded _down_ to `12px` specifically
to keep this rule, rather than rounded up to `14px` — `14px` would have partially reversed the "this
page reads too large" correction this scale existed to fix. The rule matters for legibility and
consistency as more roles get added later, not just for this one measurement: a small, even-numbered
set of sizes stays predictable to reason about and to divide/scale together; an odd value picked
"because that's what was measured" doesn't.

**Second size-reduction pass**: the page still read as too large at `12px`/`16px`/`24px`, so every
token here was reduced again to roughly 80% of its prior value, still snapped to the nearest even
integer per the hard rule above — not a literal `x0.8`, since 12/16/24 don't have clean even `x0.8`
results (12→10, 16→12, 24→20).

`--text-input` and `--text-label` are numerically equal right now. Kept as separate tokens anyway
(see "Same value, different role" above).

## Spacing, radius, motion

- **Spacing base unit**: `--spacing: 3.2px` (Tailwind's spacing-scale multiplier — `px-3` is three
  of these, `py-1.5` is one and a half). Was `4px`; reduced to a literal `x0.8` as part of the same
  size-reduction pass as the font tokens above — unlike font-size, spacing has no evenness
  constraint, so this one isn't rounded.
- **Radius**: `--radius-control` and `--radius-panel` are both `0px`. Sharp corners everywhere is
  an explicit choice, not an inherited default — getdesign.md's own buttons measured a real `4px`
  (primary) to `6px` (ghost/badge) radius; this project chose flatter than that reference on this
  one specific point (see "Rejected defaults").
- **Motion**: `--motion-hover: 150ms` is the one transition duration used anywhere on this page
  (`transition-colors duration-(--motion-hover)`), applied uniformly to every hover/focus color
  change. Not an arbitrary pick — it matches the one real, consistent duration measured across
  every hover-capable element on getdesign.md itself, the one point where this project kept the
  reference's value rather than departing from it.
- **No `box-shadow` anywhere.** getdesign.md's own chrome (buttons, header, nav) measured
  `box-shadow: none` universally when checked — this page follows that by confirmed absence, not
  by omission.

## Component conventions

See `STYLING.md` for the full `react-twc` (`twx`) vs. `tailwind-variants` (`tv`) decision rule and
code examples — not duplicated here. In short: `twx` for a single element whose own classes vary
by its own props (the `Button` primitive); `tv({ slots })` for several sibling elements that must
react to one shared judgment together (a field's label + input + error all responding to the same
`invalid` state).

## Button-state color philosophy

- **Primary/CTA** (`Generate`, and whichever of Software ID/System ID is currently selected) is a flat
  color block: `border-cta-bg` on `bg-cta-bg` — the border is always identical to the fill by
  construction (the same token, not two tokens that happen to currently match), so it reads as a
  solid shape, not an outlined one. Hover is `brightness-110` on the whole element rather than a
  separate border-color utility — brightening a border that already equals the fill keeps it
  purple-hued without a second, competing color rule fighting it.
- **Every non-primary button** (the Software ID/System ID switch in its unselected state, Copy) is the
  one deliberate exception: a real, visible `border-panel-border` at rest. This was tried both ways
  during development — matching the panel background (border invisible at rest, like the CTA) was
  tried first for the ID-mode switch specifically, and reverted, because a toggle between two
  options needs its unselected option to still read as a distinct, clickable target; removing that
  border made the two states look unrelated rather than like one control. `hover:border-accent/50`
  gives every non-primary button the same purple-hued attention cue on hover that primary reaches
  via `brightness-110`, so hover reads as one consistent color language app-wide even though the
  two variants get there through different mechanisms.
- **Every focus state** (inputs, selects) also uses `focus:border-accent/50`, for the identical
  reason — hover and focus are both "the user is paying attention to this control right now," and
  both get the same color instead of two different accent colors doing the same job.

## Rejected defaults

- **OS-driven theming** (`prefers-color-scheme`). Tailwind v4 does this automatically with zero
  configuration; this project explicitly overrode it with `@custom-variant dark` keyed to a
  `.dark` class or `[data-theme="dark"]` attribute instead, so theme is a deliberate, code-driven
  state rather than something that silently changes because of a setting on the visitor's OS a
  page author never sees.
- **Rounded corners.** getdesign.md's own measured buttons have real, if small (4–6px), radius.
  This project chose `0px` everywhere instead — deliberately flatter than the reference it started
  from, not inherited uncritically.
- **A secondary/pink accent color living alongside the CTA purple.** getdesign.md's own palette
  splits these (a pink `--color-accent` distinct from an amber CTA). This project's own earlier
  history also carried two accents for two jobs at different points. Both were retired in favor of
  one purple doing every "interactive attention" job — CTA fill, hover cue, focus cue — because two
  colors signaling the same kind of thing read as two unrelated visual languages, not one system.
- **Odd-numbered font sizes**, even when a direct measurement lands on one — see the type scale
  section above.

## Accessibility baseline

- **Contrast is computed, not eyeballed**, for every CTA color pairing:
  - Light CTA (`#793df9` bg / `#ffffff` fg): **~5.46:1** — passes the 4.5:1 WCAG AA threshold for
    normal text at this page's `10px` button text.
  - Dark CTA (`#7c3aed` bg / `#ffffff` fg): **~5.70:1** — verified independently for this theme
    rather than assumed to still hold from light; a brighter candidate (`#8b5cf6`) was tried first
    and only reached ~4.23:1 with white text, which fails, and was rejected for exactly that reason.
- **Focus is always visibly indicated** — every input/select/button gets a
  `focus:border-accent/50` (or, for the CTA button, a `brightness-110` shift) on interaction;
  nothing on this page relies on an invisible/default-only focus ring.
- **No information is conveyed by color alone that isn't also conveyed by text.** Error states pair
  a color change with an actual error message string; the Copy button's states are
  "Copy" / "Copied" / a separate "Copy failed — select and copy manually" message, never a color
  shift alone.
