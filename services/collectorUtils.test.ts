import { describe, expect, it } from 'vitest';
import { Branch } from '../types';
import { dedupeCollectors, getCollectorDisplayName, hasDuplicateCollectorIdentity, normalizeCollectorKey } from './collectorUtils';

describe('collectorUtils', () => {
  it('normalizes collector names for grouping', () => {
    expect(normalizeCollectorKey(' Aldie ')).toBe('ALDIE');
    expect(normalizeCollectorKey('ALDIE\u200B')).toBe('ALDIE');
    expect(normalizeCollectorKey('Aldie   Rosal')).toBe('ALDIE ROSAL');
  });

  it('uses collector nickname as the display grouping key', () => {
    const collectors = [
      { id: 'c1', name: 'ROSAL', nickname: 'ALDIE', branch: Branch.ORMOC },
      { id: 'c2', name: 'ROSAL PASTDUE', nickname: 'ALDIE', branch: Branch.ORMOC },
    ];

    expect(getCollectorDisplayName('ROSAL', collectors)).toBe('ALDIE');
    expect(getCollectorDisplayName(' aldie ', collectors)).toBe('ALDIE');
    expect(getCollectorDisplayName('ROSAL PASTDUE', collectors)).toBe('ALDIE');
  });

  it('dedupes collectors by their active display identity', () => {
    const collectors = [
      { id: 'c1', name: 'Aldie Rosal', nickname: 'ALDIE', branch: Branch.ORMOC },
      { id: 'c2', name: 'Aldie Rosal Pastdue', nickname: 'ALDIE ', branch: Branch.ORMOC },
      { id: 'c3', name: 'Masoy', nickname: '', branch: Branch.ORMOC },
    ];

    expect(dedupeCollectors(collectors).map(c => c.id)).toEqual(['c1', 'c3']);
  });

  it('detects duplicate name or nickname across collector records', () => {
    const collectors = [
      { id: 'c1', name: 'Aldie Rosal', nickname: 'ALDIE', branch: Branch.ORMOC },
    ];

    expect(hasDuplicateCollectorIdentity(collectors, { name: 'ALDIE', nickname: '' })).toBe(true);
    expect(hasDuplicateCollectorIdentity(collectors, { name: 'Another Person', nickname: ' aldie ' })).toBe(true);
    expect(hasDuplicateCollectorIdentity(collectors, { name: 'Aldie Rosal', nickname: 'ALDIE' }, 'c1')).toBe(false);
  });
});
