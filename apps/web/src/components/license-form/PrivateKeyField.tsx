// The private key field: its own component (not a plain render function like the ones in
// ./formControls.tsx) because it needs its own `visible` (show/hide) state - see the comment on
// PrivateKeyField itself for why that requires a real component.
import { useState } from 'react';
import { fieldStyles } from './styles';
import { formatPrivateKeyInput } from '../../lib/licenseFormLogic';

function createPrivateKeyChangeHandler(field: { handleChange: (value: string) => void }) {
  return function handlePrivateKeyChange(event: React.ChangeEvent<HTMLInputElement>) {
    field.handleChange(formatPrivateKeyInput(event.target.value));
  };
}

// Minimal inline SVGs rather than pulling in an icon library dependency for two icons - the app
// has no icon package installed today, and "open"/"closed" eye is simple enough to draw directly.
function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.9 5.1A11 11 0 0 1 12 5c7 0 11 7 11 7a13.4 13.4 0 0 1-3.4 4.2M6.4 6.4A13.4 13.4 0 0 0 1 12s4 7 11 7a10.7 10.7 0 0 0 3.6-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A real component (not a plain render function like the other `render*Field` helpers in
// ./formControls.tsx) because it needs its own `visible` state - `<form.Field>`'s children
// callback runs inline during the parent's render, so calling `useState` directly inside a
// callback passed there would break React's hook-call-order rule the moment any other field
// re-renders independently; wrapping it in a real component gives that state its own stable
// instance instead.
export function PrivateKeyField({
  field,
}: {
  field: {
    state: { value: string; meta: { isValid: boolean; errors: unknown[] } };
    handleChange: (value: string) => void;
    handleBlur: () => void;
  };
}) {
  const [visible, setVisible] = useState(false);
  const isInvalid = !field.state.meta.isValid;
  const styles = fieldStyles({ invalid: isInvalid });

  function toggleVisible() {
    setVisible((prev) => !prev);
  }

  return (
    <div className={styles.base()}>
      <label className={styles.label()}>
        Private key
        <div className="relative mt-1">
          <input
            type={visible ? 'text' : 'password'}
            className={`${styles.input()} pr-9`}
            value={field.state.value}
            onChange={createPrivateKeyChangeHandler(field)}
            onBlur={field.handleBlur}
          />
          <button
            type="button"
            onClick={toggleVisible}
            className="absolute inset-y-0 right-0 flex items-center px-2.5 text-soft transition-colors duration-(--motion-hover) hover:text-strong"
            aria-label={visible ? 'Hide private key' : 'Show private key'}
            aria-pressed={visible}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </label>
      {isInvalid && <em className={styles.error()}>{field.state.meta.errors.join(', ')}</em>}
    </div>
  );
}
