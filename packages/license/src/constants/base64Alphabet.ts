// Shared alphabet used by TWO distinct things in the real system, all ported here from the same
// Python source (`tools/mikrotik_license/constants.py::BASE64_ALPHABET`):
//   1. The custom little-endian base64 codec (`Base64.ts`) used to render the final license blob.
//   2. `systemIdDecode()`/`systemIdEncode()` (`SystemId.ts`) for the 11-char System-ID form.
// (Software-ID's `XXXX-XXXX` form uses a *different* table - see `base35Alphabet.ts`'s doc comment
// for why: this alphabet was confirmed wrong for that purpose against a real-hardware signature.)
// Python defines it once and both functions import it from the same place; kept as one constant
// here for the same reason - if this table were ever wrong, every consumer must be wrong
// identically (matching a single upstream mistake) rather than independently-transcribed copies
// silently drifting apart.
export const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
