import { afterEach, describe, expect, it, vi } from 'vitest';
import { isStoragePersisted, requestPersistentStorage } from '../db';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage durability (navigator.storage)', () => {
  it('requestPersistentStorage resolves true when the browser grants persist()', async () => {
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(true) } });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });

  it('requestPersistentStorage resolves false when the browser denies persist()', async () => {
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.resolve(false) } });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('requestPersistentStorage resolves false when the Storage API is missing', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('requestPersistentStorage resolves false (never throws) when persist() rejects', async () => {
    vi.stubGlobal('navigator', {
      storage: { persist: () => Promise.reject(new Error('SecurityError')) },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('isStoragePersisted reflects persisted() and defaults to false when unsupported', async () => {
    vi.stubGlobal('navigator', { storage: { persisted: () => Promise.resolve(true) } });
    await expect(isStoragePersisted()).resolves.toBe(true);

    vi.stubGlobal('navigator', {});
    await expect(isStoragePersisted()).resolves.toBe(false);
  });
});
