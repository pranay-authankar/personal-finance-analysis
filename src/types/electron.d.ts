import type { VaultApiBridge } from '../../electron/types.ts';

declare global {
  interface Window {
    vaultApi?: VaultApiBridge;
  }
}

export {};
