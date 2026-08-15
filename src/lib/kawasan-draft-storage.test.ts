import {
  deleteKawasanDraft,
  getKawasanDraft,
  kawasanDraftSaveErrorMessage,
  kawasanDraftStorageKey,
  listKawasanDrafts,
  MAX_KAWASAN_DRAFTS,
  saveKawasanDraft,
} from './kawasan-draft-storage';

/** A minimal in-memory `Storage`, so these tests need no DOM. */
function fakeStorage(initial: Record<string, string> = {}): Storage & {
  failNextSet?: Error;
} {
  const map = new Map(Object.entries(initial));
  const store = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => {
      if (store.failNextSet) {
        const error = store.failNextSet;
        store.failNextSet = undefined;
        throw error;
      }
      map.set(key, value);
    },
    failNextSet: undefined as Error | undefined,
  };
  return store as Storage & { failNextSet?: Error };
}

const AT = (iso: string) => new Date(iso);

describe('saveKawasanDraft', () => {
  it('mints an id on first save and reuses it afterwards', () => {
    const storage = fakeStorage();
    const first = saveKawasanDraft(
      1,
      { payload: { namaKawasan: 'Hutan Lindung' } },
      storage,
      AT('2026-08-15T01:00:00Z')
    );
    expect(first.id).toBeTruthy();

    const second = saveKawasanDraft(
      1,
      { id: first.id, payload: { namaKawasan: 'Hutan Lindung Sangatta' } },
      storage,
      AT('2026-08-15T02:00:00Z')
    );

    expect(second.id).toBe(first.id);
    const drafts = listKawasanDrafts(1, storage);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].payload.namaKawasan).toBe('Hutan Lindung Sangatta');
  });

  it('keeps one user out of another’s drafts on a shared workstation', () => {
    const storage = fakeStorage();
    saveKawasanDraft(1, { payload: { namaKawasan: 'Milik Andi' } }, storage);
    saveKawasanDraft(2, { payload: { namaKawasan: 'Milik Budi' } }, storage);

    expect(listKawasanDrafts(1, storage).map((d) => d.payload.namaKawasan)).toEqual([
      'Milik Andi',
    ]);
    expect(listKawasanDrafts(2, storage).map((d) => d.payload.namaKawasan)).toEqual([
      'Milik Budi',
    ]);
    expect(storage.getItem(kawasanDraftStorageKey(1))).not.toBeNull();
  });

  it('lists newest first', () => {
    const storage = fakeStorage();
    saveKawasanDraft(1, { payload: { namaKawasan: 'Lama' } }, storage, AT('2026-08-01T00:00:00Z'));
    saveKawasanDraft(1, { payload: { namaKawasan: 'Baru' } }, storage, AT('2026-08-10T00:00:00Z'));

    expect(listKawasanDrafts(1, storage).map((d) => d.payload.namaKawasan)).toEqual([
      'Baru',
      'Lama',
    ]);
  });

  it('drops the stalest draft past the cap, never the one being saved', () => {
    const storage = fakeStorage();
    for (let i = 0; i < MAX_KAWASAN_DRAFTS; i += 1) {
      saveKawasanDraft(
        1,
        { payload: { namaKawasan: `Kawasan ${i}` } },
        storage,
        // Ascending, so "Kawasan 0" is the oldest.
        AT(`2026-08-${String(i + 1).padStart(2, '0')}T00:00:00Z`)
      );
    }
    const newest = saveKawasanDraft(
      1,
      { payload: { namaKawasan: 'Yang Baru' } },
      storage,
      AT('2026-09-01T00:00:00Z')
    );

    const names = listKawasanDrafts(1, storage).map((d) => d.payload.namaKawasan);
    expect(names).toHaveLength(MAX_KAWASAN_DRAFTS);
    expect(names).toContain('Yang Baru');
    expect(names).not.toContain('Kawasan 0');
    expect(getKawasanDraft(1, newest.id, storage)).not.toBeNull();
  });

  it('propagates a quota failure instead of reporting a save that did not happen', () => {
    const storage = fakeStorage();
    const quota = new Error('quota');
    quota.name = 'QuotaExceededError';
    storage.failNextSet = quota;

    expect(() =>
      saveKawasanDraft(1, { payload: { namaKawasan: 'Besar' } }, storage)
    ).toThrow();
    expect(listKawasanDrafts(1, storage)).toEqual([]);
    expect(kawasanDraftSaveErrorMessage(quota)).toContain('penuh');
  });

  it('records which kawasan an edit draft belongs to', () => {
    const storage = fakeStorage();
    const saved = saveKawasanDraft(
      1,
      { editingAreaId: 42, payload: { namaKawasan: 'Revisi' } },
      storage
    );
    expect(saved.editingAreaId).toBe(42);
    expect(getKawasanDraft(1, saved.id, storage)?.editingAreaId).toBe(42);

    const fresh = saveKawasanDraft(1, { payload: {} }, storage);
    expect(fresh.editingAreaId).toBeNull();
  });
});

describe('reading a damaged or absent store', () => {
  it('returns nothing rather than throwing into a render', () => {
    expect(listKawasanDrafts(1, fakeStorage({ [kawasanDraftStorageKey(1)]: 'not json' }))).toEqual(
      []
    );
    expect(
      listKawasanDrafts(1, fakeStorage({ [kawasanDraftStorageKey(1)]: '{"nope":true}' }))
    ).toEqual([]);
    expect(listKawasanDrafts(1, null)).toEqual([]);
    expect(getKawasanDraft(1, 'anything', null)).toBeNull();
  });

  it('skips entries that are not usable drafts', () => {
    const storage = fakeStorage({
      [kawasanDraftStorageKey(1)]: JSON.stringify([
        { id: 'ok', payload: { namaKawasan: 'Baik' }, lastSaved: '2026-08-01T00:00:00Z', editingAreaId: null },
        { id: 7, payload: {} },
        { payload: {} },
        'rubbish',
      ]),
    });
    expect(listKawasanDrafts(1, storage).map((d) => d.id)).toEqual(['ok']);
  });
});

describe('deleteKawasanDraft', () => {
  it('removes only the named draft', () => {
    const storage = fakeStorage();
    const a = saveKawasanDraft(1, { payload: { namaKawasan: 'A' } }, storage, AT('2026-08-01T00:00:00Z'));
    const b = saveKawasanDraft(1, { payload: { namaKawasan: 'B' } }, storage, AT('2026-08-02T00:00:00Z'));

    deleteKawasanDraft(1, a.id, storage);

    expect(listKawasanDrafts(1, storage).map((d) => d.id)).toEqual([b.id]);
    expect(getKawasanDraft(1, a.id, storage)).toBeNull();
  });
});
