// MikroTik's non-standard state/K. This is exactly as secret as this repository is — sharing the repo
// shares the constants. See ../../docs/DESIGN.md. Lives here (packages/license), not in
// packages/sha256, because that package is meant to stay a generic, potentially-reusable SHA-256
// engine — company-specific constants don't belong in something that might get extracted or shared
// on its own. packages/license itself is inherently MikroTik-specific already (it has no purpose
// outside this product), so keeping this file here doesn't create the same risk.
export const MIKROTIK_STATE = [
  0x5b653932, 0x7b145f8f, 0x71ffb291, 0x38ef925f, 0x03e1aaf9, 0x4a2057cc, 0x4caf4dd9, 0x643cc9ea,
];

export const MIKROTIK_KEY = [
  0x0548d563, 0x98308eab, 0x37af7ccc, 0xdfbc4e3c, 0xf125aac9, 0xec98acb8, 0x8b540795, 0xd3e0ef0e,
  0x4904d6e5, 0x0da84981, 0x9a1f8452, 0x00eb7eaa, 0x96f8e3b3, 0xa6cdb655, 0xe7410f9e, 0x8eecb03d,
  0x9c6a7c25, 0xd77b072f, 0x6e8f650a, 0x124e3640, 0x7e53785a, 0xe0150772, 0xc61ef4e0, 0xbc57e5e0,
  0xc0f9a285, 0xdb342856, 0x190834c7, 0xfbeb7d8e, 0x251bed34, 0x0e9f2aad, 0x256ab901, 0x0a5b7890,
  0x9f124f09, 0xd84a9151, 0x427af67a, 0x8059c9aa, 0x13eab029, 0x3153cdf1, 0x262d405d, 0xa2105d87,
  0x9c745f15, 0xd1613847, 0x294ce135, 0x20fb0f3c, 0x8424d8ed, 0x8f4201b6, 0x12ca1ea7, 0x2054b091,
  0x463d8288, 0xc83253c3, 0x33ea314a, 0x9696dc92, 0xd041ce9a, 0xe5477160, 0xc7656be8, 0x5179fe33,
  0x1f4726f1, 0x5f393af0, 0x26e2d004, 0x6d020245, 0x85fdf6d7, 0xb0237c56, 0xff5fbd94, 0xa8b3f534,
];
