import { describe, expect, it } from 'vitest';
import { Branch } from '../types';
import { dedupeCollectors, getCollectorDisplayName, hasDuplicateCollectorIdentity, normalizeCollectorAliasKey, normalizeCollectorKey, normalizeCollectorLooseKey } from './collectorUtils';

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

  it('resolves legacy first-name and pastdue labels to the current active nickname', () => {
    const collectors = [
      { id: 'c1', name: 'Eddie Caballes', nickname: 'CABALLES', branch: Branch.ORMOC },
      { id: 'c2', name: 'Renato Dominggono', nickname: 'DOMINGGONO', branch: Branch.ORMOC },
      { id: 'c3', name: 'Angelito Torreta', nickname: 'TORRETA', branch: Branch.ORMOC },
      { id: 'c4', name: 'Reynaldo Laude', nickname: 'LAUDE', branch: Branch.ORMOC },
    ];

    expect(normalizeCollectorAliasKey('RENATO PAST DUE')).toBe('RENATO');
    expect(normalizeCollectorLooseKey('DOMINGGONO')).toBe('DOMINGONO');
    expect(getCollectorDisplayName('EDDIE', collectors)).toBe('CABALLES');
    expect(getCollectorDisplayName('RENATO', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('RENATO PAST DUE', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('DOMINGONO', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('REYNALDO', collectors)).toBe('LAUDE');
    expect(getCollectorDisplayName('LAUDE PASTDUE', collectors)).toBe('LAUDE');
    expect(getCollectorDisplayName('ANGELITO', collectors)).toBe('TORRETA');
    expect(getCollectorDisplayName('TORRETA PASTDUE', collectors)).toBe('TORRETA');
    expect(getCollectorDisplayName('LITO', collectors)).toBe('TORRETA');
    expect(getCollectorDisplayName('MASOY', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('TATA', collectors)).toBe('LAUDE');
  });

  it('uses the Collector Module active nickname as the source of truth for official identities', () => {
    const collectors = [
      { id: 'c1', name: 'Aldie Rosal', nickname: 'ROSAL', branch: Branch.ORMOC },
      { id: 'c2', name: 'Eddie Caballes', nickname: 'CABALLES', branch: Branch.ORMOC },
      { id: 'c3', name: 'Noel Jugar', nickname: 'JUGAR', branch: Branch.ORMOC },
      { id: 'c4', name: 'Renato Dominggono', nickname: 'DOMINGGONO', branch: Branch.ORMOC },
      { id: 'c5', name: 'Reynaldo Laude', nickname: 'LAUDE', branch: Branch.ORMOC },
      { id: 'c6', name: 'Angelito Torreta', nickname: 'TORRETA', branch: Branch.ORMOC },
      { id: 'c7', name: 'Ormoc Pastdue', nickname: 'PD ORMOC', branch: Branch.ORMOC },
      { id: 'c8', name: 'Carigara Pastdue', nickname: 'PD CARIGARA', branch: Branch.ORMOC },
      { id: 'c9', name: 'Palompon Pastdue', nickname: 'PD PALOMPON', branch: Branch.ORMOC },
      { id: 'c10', name: 'Isabel Pastdue', nickname: 'PD ISABEL', branch: Branch.ORMOC },
      { id: 'c11', name: 'Baybay Pastdue', nickname: 'PD BAYBAY', branch: Branch.ORMOC },
      { id: 'c12', name: 'Kananga Pastdue', nickname: 'PD KANANGA', branch: Branch.ORMOC },
      { id: 'c13', name: 'San Isidro Pastdue', nickname: 'PD SAN ISIDRO', branch: Branch.ORMOC },
      { id: 'c14', name: 'Office', nickname: 'OFFICE', branch: Branch.ORMOC },
    ];

    expect(getCollectorDisplayName('Aldie Rosal', collectors)).toBe('ROSAL');
    expect(getCollectorDisplayName('ROSAL PASTDUE', collectors)).toBe('ROSAL');
    expect(getCollectorDisplayName('EDDIE', collectors)).toBe('CABALLES');
    expect(getCollectorDisplayName('NOEL', collectors)).toBe('JUGAR');
    expect(getCollectorDisplayName('RENATO PAST DUE', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('DOMINGONO', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('MASOY', collectors)).toBe('DOMINGGONO');
    expect(getCollectorDisplayName('REYNALDO', collectors)).toBe('LAUDE');
    expect(getCollectorDisplayName('TATA', collectors)).toBe('LAUDE');
    expect(getCollectorDisplayName('ANGELITO', collectors)).toBe('TORRETA');
    expect(getCollectorDisplayName('LITO', collectors)).toBe('TORRETA');
    expect(getCollectorDisplayName('ORMOC PASTDUE', collectors)).toBe('PD ORMOC');
    expect(getCollectorDisplayName('PD ORMOC', collectors)).toBe('PD ORMOC');
    expect(getCollectorDisplayName('PD ORMOC', [
      { id: 'c7', name: 'Ormoc Pastdue', nickname: 'PD ORMO', branch: Branch.ORMOC },
    ])).toBe('PD ORMO');
    expect(getCollectorDisplayName('CARIGARA PASTDUE', collectors)).toBe('PD CARIGARA');
    expect(getCollectorDisplayName('PALOMPON', collectors)).toBe('PD PALOMPON');
    expect(getCollectorDisplayName('ISABEL PASTDUE', collectors)).toBe('PD ISABEL');
    expect(getCollectorDisplayName('BAYBAY', collectors)).toBe('PD BAYBAY');
    expect(getCollectorDisplayName('KANANGA PASTDUE', collectors)).toBe('PD KANANGA');
    expect(getCollectorDisplayName('SAN ISIDRO PASTDUE', collectors)).toBe('PD SAN ISIDRO');
    expect(getCollectorDisplayName('Office', collectors)).toBe('OFFICE');
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
