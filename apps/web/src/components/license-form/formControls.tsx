// The field-level change-handler factories and JSX renderers for the license form's remaining
// fields (System/Software ID, level, features, days, license type). Each pairs one field's
// TanStack Form wiring with the markup for that field, so the two stay next to each other instead
// of split across files - unlike ../../lib/licenseFormLogic.ts, everything here is coupled to
// either a DOM event or a TanStack Form field/form object. The private key field is its own
// component (./PrivateKeyField.tsx), not here, because it needs its own local `visible` state.
import type { LicenseType } from '@mtlic/license';
import {
  type IdMode,
  type LevelOption,
  levelOptionsForMode,
  defaultLevelForMode,
  formatSoftwareIdInput,
  daysForLicenseType,
  SOFTWARE_ID_FEATURES_DEFAULT,
  SOFTWARE_ID_FEATURES_MIN,
  SOFTWARE_ID_FEATURES_MAX,
  SYSTEM_ID_LENGTH,
  SOFTWARE_ID_RAW_LENGTH,
  MIN_SUBSCRIPTION_DAYS,
  validateDays,
} from '../../lib/licenseFormLogic';
import { fieldStyles, inlineSelectClass, inlineNumberClass, inlineErrorClass } from './styles';

function createTextFieldChangeHandler(field: { handleChange: (value: string) => void }) {
  return function handleTextFieldChange(event: React.ChangeEvent<HTMLInputElement>) {
    field.handleChange(event.target.value);
  };
}

function createSoftwareIdChangeHandler(field: { handleChange: (value: string) => void }) {
  return function handleSoftwareIdChange(event: React.ChangeEvent<HTMLInputElement>) {
    field.handleChange(formatSoftwareIdInput(event.target.value));
  };
}

function createNumberFieldChangeHandler(field: { handleChange: (value: number) => void }) {
  return function handleNumberFieldChange(event: React.ChangeEvent<HTMLInputElement>) {
    field.handleChange(Number(event.target.value));
  };
}

function createLicenseTypeChangeHandler(form: {
  setFieldValue: (field: string, value: unknown) => void;
}) {
  return function handleLicenseTypeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextType = event.target.value as LicenseType;
    // Deliberately not preserving a prior custom day count across type switches — simplicity
    // over statefulness, per instruction. Each switch resets to that type's own default.
    form.setFieldValue('licenseType', nextType);
    form.setFieldValue('days', daysForLicenseType(nextType));
  };
}

// `form` is typed `any` here for the same reason as createLicenseTypeFieldRenderer's `form`
// param below: TanStack Form's real `setFieldValue` type is a generic constrained to this form's
// exact field-name union, which a hand-written `{ setFieldValue: (field: string, ...) => void }`
// signature is structurally incompatible with (a plain `string` parameter accepts more than the
// real generic does) - not worth spelling out the full generic just for one call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createIdModeSelectHandler(
  mode: IdMode,
  setIdMode: (mode: IdMode) => void,
  form: any,
) {
  return function handleIdModeSelect() {
    setIdMode(mode);
    // The two modes' level option sets don't overlap - reset to the new mode's own default
    // rather than leaving a value that's invalid under the newly-rendered options. `features`
    // (Software-ID only) always resets to its own default too, even when switching to System-ID
    // where it isn't rendered - cheap no-op, and avoids a stale value lingering for next time.
    form.setFieldValue('level', defaultLevelForMode(mode));
    form.setFieldValue('features', SOFTWARE_ID_FEATURES_DEFAULT);
    // System ID and Software ID have entirely different formats (11-char [0-9a-zA-Z+/] vs
    // XXXX-XXXX) and share this one form field - a value typed under the old mode is never valid
    // under the new mode's validator, so it must be cleared rather than left sitting there as a
    // stale, format-mismatched value (and a misleading validation error) the user didn't type.
    form.setFieldValue('systemId', '');
  };
}

function createLevelChangeHandler(field: { handleChange: (value: number) => void }) {
  return function handleLevelChange(event: React.ChangeEvent<HTMLSelectElement>) {
    field.handleChange(Number(event.target.value));
  };
}

function renderLevelOption(option: LevelOption) {
  return (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLevelFieldRenderer(idMode: IdMode) {
  return function renderLevelField(field: any) {
    return (
      <div className="mb-4">
        <label className="text-label text-soft">
          License level
          <select
            className={inlineSelectClass}
            value={field.state.value}
            onChange={createLevelChangeHandler(field)}
          >
            {levelOptionsForMode(idMode).map(renderLevelOption)}
          </select>
        </label>
      </div>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createFeaturesFieldRenderer() {
  return function renderFeaturesField(field: any) {
    const isInvalid = !field.state.meta.isValid;
    return (
      <div className="mb-4">
        <label className="text-label text-soft">
          Features
          <input
            type="number"
            min={SOFTWARE_ID_FEATURES_MIN}
            max={SOFTWARE_ID_FEATURES_MAX}
            className={inlineNumberClass}
            value={field.state.value}
            onChange={createNumberFieldChangeHandler(field)}
            onBlur={field.handleBlur}
          />
        </label>
        {isInvalid && <em className={inlineErrorClass}>{field.state.meta.errors.join(', ')}</em>}
      </div>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSystemIdFieldRenderer(idMode: IdMode) {
  return function renderSystemIdField(field: any) {
    const isInvalid = !field.state.meta.isValid;
    const styles = fieldStyles({ invalid: isInvalid });
    return (
      <div className={styles.base()}>
        <label className={styles.label()}>
          {idMode === 'softwareId' ? 'Software ID' : 'System ID'}
          <input
            className={`${styles.input()} mt-1`}
            value={field.state.value}
            onChange={
              idMode === 'softwareId'
                ? createSoftwareIdChangeHandler(field)
                : createTextFieldChangeHandler(field)
            }
            onBlur={field.handleBlur}
            maxLength={idMode === 'softwareId' ? SOFTWARE_ID_RAW_LENGTH + 1 : SYSTEM_ID_LENGTH}
            placeholder={idMode === 'softwareId' ? 'XXXX-XXXX' : undefined}
          />
        </label>
        {isInvalid && <em className={styles.error()}>{field.state.meta.errors.join(', ')}</em>}
      </div>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createDaysFieldRenderer(licenseType: LicenseType) {
  return function renderDaysField(field: any) {
    const isInvalid = !field.state.meta.isValid;
    return (
      <label className="ml-4 text-label text-soft">
        Days
        <input
          type="number"
          min={licenseType === 'subscription' ? MIN_SUBSCRIPTION_DAYS : undefined}
          className={inlineNumberClass}
          value={field.state.value}
          onChange={createNumberFieldChangeHandler(field)}
          disabled={licenseType === 'trial' || licenseType === 'permanent'}
        />
        {isInvalid && <em className={inlineErrorClass}>{field.state.meta.errors.join(', ')}</em>}
      </label>
    );
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createLicenseTypeFieldRenderer(form: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function renderLicenseTypeField(field: any) {
    return (
      <div className="mb-4">
        <label className="text-label text-soft">
          License type
          <select
            className={inlineSelectClass}
            value={field.state.value}
            onChange={createLicenseTypeChangeHandler(form)}
          >
            <option value="permanent">Permanent</option>
            <option value="subscription">Subscription</option>
            <option value="trial">Trial</option>
          </select>
        </label>
        <form.Field name="days" validators={{ onChange: validateDays }}>
          {createDaysFieldRenderer(field.state.value)}
        </form.Field>
      </div>
    );
  };
}
