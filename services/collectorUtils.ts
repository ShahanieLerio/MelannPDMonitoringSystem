import { Collector } from '../types';

const LEGACY_COLLECTOR_ALIASES_BY_NAME: Record<string, string[]> = {
  'ANGELITO TORRETA': ['LITO'],
  'RENATO DOMINGGONO': ['MASOY', 'DOMINGONO'],
  'REYNALDO LAUDE': ['TATA'],
};

export const normalizeCollectorKey = (collector?: string | null) =>
  String(collector || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

export const normalizeCollectorAliasKey = (collector?: string | null) =>
  normalizeCollectorKey(collector)
    .replace(/\bPAST\s*DUE\b/g, 'PASTDUE')
    .replace(/\bPASTDUE\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeCollectorLooseKey = (collector?: string | null) =>
  normalizeCollectorAliasKey(collector)
    .replace(/[^A-Z0-9]/g, '')
    .replace(/(.)\1+/g, '$1');

export const getCollectorIdentity = (collector: Pick<Collector, 'name' | 'nickname'>) =>
  normalizeCollectorKey(collector.nickname || collector.name);

export const getCollectorIdentityCandidates = (collector: Pick<Collector, 'name' | 'nickname'>) =>
  [collector.name, collector.nickname]
    .map(normalizeCollectorKey)
    .filter(Boolean);

export const getCollectorDisplayMatchKeys = (collector: Pick<Collector, 'name' | 'nickname'>) => {
  const keys = new Set<string>();
  const addKey = (value?: string | null) => {
    const normalized = normalizeCollectorKey(value);
    if (normalized) keys.add(normalized);

    const alias = normalizeCollectorAliasKey(value);
    if (alias) keys.add(alias);

    const loose = normalizeCollectorLooseKey(value);
    if (loose) keys.add(loose);
  };

  addKey(collector.name);
  addKey(collector.nickname);

  normalizeCollectorKey(collector.name)
    .split(' ')
    .filter(Boolean)
    .forEach(addKey);

  const nameParts = normalizeCollectorKey(collector.name)
    .split(' ')
    .filter(part => part && part !== 'PASTDUE' && part !== 'PAST' && part !== 'DUE');
  if (normalizeCollectorAliasKey(collector.name) !== normalizeCollectorKey(collector.name)) {
    nameParts.forEach(part => addKey(`PD ${part}`));
  }

  LEGACY_COLLECTOR_ALIASES_BY_NAME[normalizeCollectorKey(collector.name)]?.forEach(addKey);

  return [...keys];
};

export const getCollectorDisplayName = (collector?: string | null, collectors: Collector[] = []) => {
  const collectorKey = normalizeCollectorKey(collector);
  if (!collectorKey) return 'UNASSIGNED';
  const aliasKey = normalizeCollectorAliasKey(collector);
  const looseKey = normalizeCollectorLooseKey(collector);

  const collectorInfo = collectors.find(c => {
    const matchKeys = getCollectorDisplayMatchKeys(c);
    return matchKeys.includes(collectorKey) ||
      Boolean(aliasKey && matchKeys.includes(aliasKey)) ||
      Boolean(looseKey && matchKeys.includes(looseKey));
  });

  return normalizeCollectorKey(collectorInfo?.nickname || collectorInfo?.name || collector);
};

export const dedupeCollectors = (collectors: Collector[] = []) => {
  const seen = new Set<string>();

  return collectors.filter(collector => {
    const identity = getCollectorIdentity(collector);
    if (!identity) return true;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

export const hasDuplicateCollectorIdentity = (
  collectors: Collector[] = [],
  candidate: Pick<Collector, 'name' | 'nickname'>,
  excludeId?: string
) => {
  const candidateKeys = new Set(getCollectorIdentityCandidates(candidate));
  if (candidateKeys.size === 0) return false;

  return collectors.some(collector => {
    if (excludeId && collector.id === excludeId) return false;
    return getCollectorIdentityCandidates(collector).some(key => candidateKeys.has(key));
  });
};
