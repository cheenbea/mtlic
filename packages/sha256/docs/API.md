# API Reference

## `Sha256`

```ts
new Sha256(options?: { state?: number[]; k?: number[]; secret?: SourceData })
```

- `state` — 8 unsigned 32-bit words replacing the standard H0–H7. Defaults to the FIPS 180-4 initial hash value.
- `k` — 64 unsigned 32-bit words replacing the standard round constants. Defaults to the FIPS 180-4 K table.
- `secret` — enables HMAC (RFC 2104) using `state`/`k` as the underlying primitive for both the inner and outer hash. Mutually exclusive with `setState()`/`setK()`/`getCheckpoint()` (see [DESIGN.md](./DESIGN.md)).

### Methods

| Method                                                   | Description                                                                                                                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `update(data: string \| ArrayBufferView \| ArrayBuffer)` | Feed data into the hash. Chainable.                                                                                                                                                                   |
| `digest(): Uint8Array`                                   | Finalize and return the raw digest. Safe to call more than once.                                                                                                                                      |
| `hexDigest(): string`                                    | `digest()` as a lowercase hex string.                                                                                                                                                                 |
| `setState({ state, bytesHashed })`                       | Replace the running state and the logical byte count used for padding. Throws unless called at a block boundary (no buffered partial-block bytes) and before `digest()`. Not available with `secret`. |
| `setK(k)`                                                | Replace the round constants. Same block-boundary/`secret` restrictions as `setState()`.                                                                                                               |
| `getCheckpoint(): { state, bytesHashed }`                | Read the current state and byte count back out, for resuming on another instance via `setState()`. Requires a block boundary. Not available with `secret`.                                            |

`MikroTikSha256` (MikroTik's fixed-constant preset) is not part of this package — see [`packages/license/API.md`](../../license/docs/API.md).
