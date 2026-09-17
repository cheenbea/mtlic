import { Sha256, type Sha256Options } from '@mtlic/sha256';
import { MIKROTIK_STATE, MIKROTIK_KEY } from './constants';

export class MikroTikSha256 extends Sha256 {
  constructor(options: Pick<Sha256Options, 'secret'> = {}) {
    super({ state: MIKROTIK_STATE, k: MIKROTIK_KEY, secret: options.secret });
  }
}
