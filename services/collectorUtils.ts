import { Collector } from '../types';

export const normalizeCollectorKey = (collector?: string | null) =>
  String(collector || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

export const getCollectorIdentity = (collector: Pick<Collector, 'name' | 'nickname'>) =>
  normalizeCollectorKey(collector.nickname || collector.name);

export const getCollectorIdentityCandidates = (collector: Pick<Collector, 'name' | 'nickname'>) =>
  [collector.name, collector.nickname]
    .map(normalizeCollectorKey)
    .filter(Boolean);

export const getCollectorDisplayName = (collector?: string | null, collectors: Collector[] = []) => {
  const collectorKey = normalizeCollectorKey(collector);
  if (!collectorKey) return 'UNASSIGNED';

  const collectorInfo = collectors.find(c =>
    normalizeCollectorKey(c.name) === collectorKey ||
    normalizeCollectorKey(c.nickname) === collectorKey
  );

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
