// Software-ID (x86, `XXXX-XXXX` form) base-35 character table, MikroTik's proprietary order (NOT
// standard base36 - notably, letter 'O' is absent to avoid confusion with digit '0'). Ported here
// from `tools/mikrotik_license/constants.py::SID_TABLE`.
//
// Confirmed correct (not a guess) against a real-hardware-confirmed signature from an independent
// reference implementation (`ros` project, `src/software_id.rs` + `src/convert.rs`): the signature
// hex
//   FAF308BA3FFD4185308A8784244749EFFE7E4E65C14C01CD55D946506B47F6
//   36757F62106D114329104012DE7B44543F3444F0E724080873E3A20E11F5EF450E
// (Software-ID `VI8Q-E90F`, level 1) decodes, via this project's own header cipher
// (`LicenseCipher.ts::decode`), to plaintext `f60b87d81d0106010000000000000000` -
// i.e. swid6 `f60b87d81d01`, whose little-endian integer value equals exactly
// `softwareIdDecode("VI8Q-E90F")` using this table, and `softwareIdEncode()` of that same value
// round-trips back to `VI8Q-E90F` exactly.
//
// IMPORTANT: this is a *different* algorithm from what the third-party `keygen_x86` tool itself
// computes internally for arbitrary strings in its x86/Software-ID mode - that tool's own internal
// mapping has been empirically confirmed to be wrong/unrelated (magnitudes off by 100x+ against
// real captured samples; see `cases/software-id/README.md`). This table implements the actual
// correct algorithm, validated against real hardware, not a reproduction of `keygen_x86`'s bug.
export const SID_TABLE = 'TN0BYX18S5HZ4IA67DGF3LPCJQRUK9MW2VE';
