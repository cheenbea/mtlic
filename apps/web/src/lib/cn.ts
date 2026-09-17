import { createCn } from 'cn/config';
import type { CnFunction } from 'cn';
import { createTwc } from 'react-twc';
import { createTV, type TV } from 'tailwind-variants';

// Without this, the default class-group detection sees our custom `--text-*` theme tokens
// (text-input/text-label/text-body/text-heading) and, not recognizing them as font-size, falls
// back to treating them as ambiguous with the `text-{color}` group. When a className mixes one
// of these with an actual text-color utility (e.g. `text-input text-strong`), the merge logic
// treats them as conflicting and silently drops the earlier one - font-size never applies, no
// error, no warning. Registering them under "font-size" is the documented fix for `cn` (see
// node_modules/cn/README.md "Custom themes"), not a guess. `tailwind-variants`' `tv()` has its
// OWN, separate merge config that does NOT inherit this - it needed the identical extension
// applied again via `createTV`, discovered by testing (fieldStyles()-derived classNames still
// silently dropped font-size after the `cn` fix alone; plain literal classNames and the `twx`
// Button already worked). Don't assume one fix covers both call sites.
const CUSTOM_FONT_SIZE_GROUPS = {
  extend: { classGroups: { 'font-size': [{ text: ['input', 'label', 'body', 'heading'] }] } },
};

export const cn: CnFunction = createCn(CUSTOM_FONT_SIZE_GROUPS);

// Wires react-twc's class-merging to our `cn` package (which replaces the traditional
// clsx + tailwind-merge combo) instead of react-twc's own default, so conflict resolution
// stays consistent everywhere `twx` is used across the app.
export const twx: ReturnType<typeof createTwc> = createTwc({ compose: cn });

// Configured `tv()` - use this instead of importing `tv` directly from `tailwind-variants`
// anywhere in the app, or the font-size drop bug above comes back for that call site.
export const tv: TV = createTV({ twMergeConfig: CUSTOM_FONT_SIZE_GROUPS });
