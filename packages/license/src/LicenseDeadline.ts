// Faithful port of `tools/scripts/licenseBySystemId.py`'s `compute_deadline()`. These are the
// three official license-type deadline formulas, confirmed by the user against real observed
// license samples (external research notes, not a file in this repository) - NOT invented here,
// and NOT simple heuristics. In particular, "subscription" is deliberately not "now + N days": it floors
// to the END of the PREVIOUS UTC calendar day first. Get this wrong and every subscription
// license this generates is off by a variable, day-boundary-dependent number of hours.
export type LicenseType = 'permanent' | 'subscription' | 'trial';

export const LICENSE_DEADLINE_PERMANENT = 0xffffffffn;

const SECONDS_PER_DAY = 86400;
export const TRIAL_DEFAULT_DAYS = 60;
export const SUBSCRIPTION_DEFAULT_DAYS = 180;

/**
 * Compute the 4-byte license deadline (as a bigint, matching `licenseBySystemId`'s
 * `deadline` parameter) for one of the three official license types.
 *
 * - trial:        now + days (default 60), keeping `now`'s original time-of-day (plain addition,
 *                 no truncation - matches Python's `now + timedelta(days=d)`).
 * - permanent:    always the 0xFFFFFFFF sentinel; `days` is accepted but ignored, same as Python.
 * - subscription: (today's UTC date - 1 day) at 23:59:59 UTC, then + days (default 180). This is
 *                 NOT `now + days*86400` - the truncation to the previous day's end-of-day is the
 *                 whole point of this formula and must not be "simplified" away.
 *
 * `now` defaults to the real current time but can be overridden for deterministic testing,
 * mirroring Python's own `now=None` parameter.
 */
export function computeDeadline(
  licenseType: LicenseType,
  days?: number,
  now: Date = new Date(),
): bigint {
  if (licenseType === 'trial') {
    const d = days ?? TRIAL_DEFAULT_DAYS;
    return BigInt(Math.floor(now.getTime() / 1000) + d * SECONDS_PER_DAY);
  }
  if (licenseType === 'permanent') {
    return LICENSE_DEADLINE_PERMANENT;
  }
  // subscription
  const d = days ?? SUBSCRIPTION_DEFAULT_DAYS;
  // now.date() - 1 day, evaluated in UTC (Python's `now` is timezone-aware UTC; using the UTC
  // calendar fields here, not local-time getters, is what keeps this correct regardless of the
  // machine's local timezone).
  const baseDateUtcMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 1,
    23,
    59,
    59,
  );
  return BigInt(Math.floor(baseDateUtcMs / 1000) + d * SECONDS_PER_DAY);
}
