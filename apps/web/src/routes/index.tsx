import { createFileRoute } from '@tanstack/react-router';
import { LicenseGenerator, type LicenseGeneratorSearch } from '../components/LicenseGenerator';

// Raw search values from TanStack Router are `unknown` (parsed from the URLSearchParams string,
// so numbers arrive as numeric strings) - this narrows/coerces each of the 7 query params the
// license form understands (privateKey, level, softwareId, features, systemId, type, days) into
// LicenseGeneratorSearch's typed shape. Anything missing, unparseable, or the wrong type is left
// undefined here rather than thrown - LicenseGenerator's own initialFormValuesFromSearch is what
// applies range/enum validation and falls back to normal defaults, so this function's only job is
// "read what's plausibly there", not "reject what's invalid".
function validateSearch(search: Record<string, unknown>): LicenseGeneratorSearch {
  const result: LicenseGeneratorSearch = {};
  if (typeof search.privateKey === 'string') result.privateKey = search.privateKey;
  if (typeof search.softwareId === 'string') result.softwareId = search.softwareId;
  if (typeof search.systemId === 'string') result.systemId = search.systemId;
  if (typeof search.type === 'string') result.type = search.type;

  const level = Number(search.level);
  if (Number.isFinite(level)) result.level = level;

  const features = Number(search.features);
  if (Number.isFinite(features)) result.features = features;

  const days = Number(search.days);
  if (Number.isFinite(days)) result.days = days;

  return result;
}

export const Route = createFileRoute('/')({
  component: HomeComponent,
  validateSearch,
});

function HomeComponent() {
  const search = Route.useSearch();
  return (
    <main className="min-h-screen bg-bg px-8 py-12 font-sans text-strong">
      <LicenseGenerator initialSearch={search} />
    </main>
  );
}
