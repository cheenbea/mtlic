import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import {
  generateLicenseFromSystemId,
  generateLicenseFromSoftwareId,
  computeDeadline,
} from '@mtlic/license';
import {
  type IdMode,
  type FormValues,
  type CopyStatus,
  type LicenseGeneratorSearch,
  initialIdModeFromSearch,
  initialFormValuesFromSearch,
  hexToBytes,
  validatePrivateKeyHex,
  createIdValidator,
  validateFeatures,
} from '../lib/licenseFormLogic';
export type { LicenseGeneratorSearch };
import {
  createIdModeSelectHandler,
  createLevelFieldRenderer,
  createFeaturesFieldRenderer,
  createSystemIdFieldRenderer,
  createLicenseTypeFieldRenderer,
} from './license-form/formControls';
import { PrivateKeyField } from './license-form/PrivateKeyField';
import { Button } from './license-form/styles';

const COPY_TIMEOUT_MS = 5000;

export interface LicenseGeneratorProps {
  initialSearch?: LicenseGeneratorSearch;
}

export function LicenseGenerator({ initialSearch = {} }: LicenseGeneratorProps = {}) {
  const [license, setLicense] = useState('');
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  // Software ID is the mode the reference generator (rosguy.dsmynas.com:8181) opens on by default,
  // and the one this app's own Software-ID pathway is now fully wired for (see handleFormSubmit
  // below) - defaulting to it here means the very first thing a user sees is a working Generate
  // button, not one disabled pending a not-yet-implemented feature. A `?softwareId=` or
  // `?systemId=` query param overrides that default - see initialIdModeFromSearch in
  // lib/licenseFormLogic.ts. The lazy initializer only reads `initialSearch` once, at mount,
  // matching useForm's defaultValues below (also only consulted once) - a query string edited
  // after the page has already loaded is deliberately not re-applied to a form the user may
  // already be mid-edit on.
  const [idMode, setIdMode] = useState<IdMode>(() => initialIdModeFromSearch(initialSearch));

  function handleFormSubmit({ value }: { value: FormValues }) {
    setError('');
    setCopyStatus('idle');
    try {
      const privateKeyBytes = hexToBytes(value.privateKey);
      if (privateKeyBytes.length !== 32) {
        throw new Error(
          `Private key must be 32 bytes (64 hex chars), got ${privateKeyBytes.length} bytes`,
        );
      }
      if (idMode === 'softwareId') {
        // `major` isn't exposed as a form field (same as the Python CLI, which defaults it to 7 too
        // - see licenseBySoftwareId.py's --major default); `level` and `features` are the two
        // independent nibbles that combine into `license[7]` (softwareGroupsByte(level, features) -
        // see the SOFTWARE_ID_FEATURES_DEFAULT comment in lib/licenseFormLogic.ts).
        setLicense(
          generateLicenseFromSoftwareId(value.systemId, privateKeyBytes, {
            level: value.level,
            groups: value.features,
          }),
        );
      } else {
        const deadline = computeDeadline(
          value.licenseType,
          value.licenseType === 'permanent' ? undefined : value.days,
        );
        setLicense(
          generateLicenseFromSystemId(value.systemId, privateKeyBytes, deadline, value.level),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const form = useForm({
    // Shown uppercase from first render for the same reason formatPrivateKeyInput uppercases
    // every keystroke: consistent with every generated license's own hex, not showing a
    // lowercase string until the user's first edit reformats it (applies whether the private key
    // came from DEFAULT_PRIVATE_KEY_HEX or a `?privateKey=` query param).
    defaultValues: initialFormValuesFromSearch(initialSearch, idMode),
    onSubmit: handleFormSubmit,
  });

  const handleSelectSystemId = createIdModeSelectHandler('systemId', setIdMode, form);
  const handleSelectSoftwareId = createIdModeSelectHandler('softwareId', setIdMode, form);

  function handleFormSubmitEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit();
  }

  // AGENTS.md requires a timeout on external/async calls: navigator.clipboard.writeText() can
  // hang indefinitely rather than reject (observed while verifying this page — a permission
  // prompt or platform quirk can leave the promise pending forever with no error at all), so a
  // rejection handler alone isn't sufficient; Promise.race enforces a ceiling so the button never
  // gets stuck silently.
  function handleCopy() {
    if (!license) return;
    setCopyStatus('idle');
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`timed out after ${COPY_TIMEOUT_MS}ms`)), COPY_TIMEOUT_MS);
    });
    Promise.race([navigator.clipboard.writeText(license), timeout]).then(
      handleCopySuccess,
      handleCopyFailure,
    );
  }

  function handleCopySuccess() {
    setCopyStatus('copied');
    setTimeout(handleCopyStatusReset, 1500);
  }

  function handleCopyFailure() {
    setCopyStatus('failed');
  }

  function handleCopyStatusReset() {
    setCopyStatus('idle');
  }

  return (
    <div className="mx-auto max-w-[461px]">
      <h1 className="mb-8 text-heading font-semibold tracking-tight text-strong">
        MikroTik License Generator
      </h1>

      <form
        onSubmit={handleFormSubmitEvent}
        className="rounded-panel border border-border bg-panel p-6"
      >
        <div className="mb-4 flex gap-2">
          <Button type="button" primary={idMode === 'softwareId'} onClick={handleSelectSoftwareId}>
            Software ID
          </Button>
          <Button type="button" primary={idMode === 'systemId'} onClick={handleSelectSystemId}>
            System ID
          </Button>
        </div>

        <form.Field name="systemId" validators={{ onChange: createIdValidator(idMode) }}>
          {createSystemIdFieldRenderer(idMode)}
        </form.Field>

        <form.Field name="level">{createLevelFieldRenderer(idMode)}</form.Field>

        {idMode === 'softwareId' && (
          <form.Field name="features" validators={{ onChange: validateFeatures }}>
            {createFeaturesFieldRenderer()}
          </form.Field>
        )}

        {idMode !== 'softwareId' && (
          <form.Field name="licenseType">{createLicenseTypeFieldRenderer(form)}</form.Field>
        )}

        <form.Field name="privateKey" validators={{ onChange: validatePrivateKeyHex }}>
          {(field) => <PrivateKeyField field={field} />}
        </form.Field>

        {error && <p className="mb-4 text-label text-danger">{error}</p>}

        <div className="mb-4">
          <label className="text-label text-soft">
            License
            <textarea
              readOnly
              value={license}
              rows={4}
              className="mt-1 w-full resize-none rounded-panel border border-border bg-panel p-3 font-mono text-input text-strong outline-none"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" primary>
            Generate
          </Button>
          <Button type="button" onClick={handleCopy} disabled={!license}>
            {copyStatus === 'copied' ? 'Copied' : 'Copy'}
          </Button>
          {copyStatus === 'failed' && (
            <p className="text-label text-danger">Copy failed — select and copy manually</p>
          )}
        </div>
      </form>
    </div>
  );
}
