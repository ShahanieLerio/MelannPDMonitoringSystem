import { Loan } from '../types.ts';

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface CollectionRoutePlan {
  cityOrder: string[];
  barangayOrderByCity: Record<string, string[]>;
  unresolvedStops: string[];
  originLabel: string;
  resolvedOriginLabel: string | null;
  routingMode: 'road' | 'approximate';
  routingWarning: string | null;
}

export type PlaceGeocoder = (query: string) => Promise<RouteCoordinate | null>;
export type RoadRouter = (coordinates: RouteCoordinate[]) => Promise<Array<Array<number | null>> | null>;

// Version bump invalidates old cached POI points from before settlement filtering.
const CACHE_KEY = 'melann.collection-route-geocodes.v2';
const MIN_REQUEST_INTERVAL_MS = 1100;
let lastGeocodeRequestAt = 0;

// Nominatim sometimes returns a chapel/bridge for barangay-name searches.
// Keep known Ormoc locality points here so route ordering does not silently
// use an unrelated point of interest. Coordinates are representative locality
// points, not exact road addresses or driving-route distances.
const ORMOC_LOCALITY_POINTS: Record<string, RouteCoordinate> = {
  'san isidro': { latitude: 11.0259, longitude: 124.5947 },
  'bagong buhay': { latitude: 11.0302, longitude: 124.5936 },
  // Owak Road / Owak Bridge area, used as the available representative point.
  owak: { latitude: 11.02679, longitude: 124.59195 }
};
const ORMOC_OFFICE_ADDRESS = 'lot 2 block 3, brgy san isidro, ormoc city, leyte';
const ORMOC_OFFICE_ROUTE_POINT = ORMOC_LOCALITY_POINTS['san isidro'];

export const getKnownOrmocCoordinate = (query: string): RouteCoordinate | null => {
  const normalized = locationKey(query).replace(/\./g, '');
  if (!normalized.includes('ormoc')) return null;
  if (normalized.includes(ORMOC_OFFICE_ADDRESS) || (normalized.includes('lot 2 block 3') && normalized.includes('san isidro'))) {
    return ORMOC_OFFICE_ROUTE_POINT;
  }

  const locality = Object.keys(ORMOC_LOCALITY_POINTS).find(name =>
    new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i').test(normalized)
  );
  return locality ? ORMOC_LOCALITY_POINTS[locality] : null;
};

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export const cleanLocationLabel = (value: string | null | undefined, fallback: string) =>
  value?.trim().replace(/\s+/g, ' ') || fallback;

export const locationKey = (value: string) => cleanLocationLabel(value, '').toLocaleLowerCase();

const wait = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

const readCache = (): Record<string, RouteCoordinate | null> => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeCache = (cache: Record<string, RouteCoordinate | null>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Route ordering still works when browser storage is unavailable.
  }
};

/**
 * End-user-triggered, cached place lookup. Only public city/barangay labels are
 * sent; borrower names and detailed borrower addresses never leave the app.
 */
export const geocodeCollectionPlace: PlaceGeocoder = async query => {
  const normalizedQuery = cleanLocationLabel(query, '');
  if (!normalizedQuery) return null;

  const knownCoordinate = getKnownOrmocCoordinate(normalizedQuery);
  if (knownCoordinate) return knownCoordinate;

  const cache = readCache();
  const cacheKey = normalizedQuery.toLocaleLowerCase();
  if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) return cache[cacheKey];

  const elapsed = Date.now() - lastGeocodeRequestAt;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) await wait(MIN_REQUEST_INTERVAL_MS - elapsed);
  lastGeocodeRequestAt = Date.now();

  const baseUrl = String(import.meta.env.VITE_GEOCODING_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  const url = new URL(`${baseUrl}/search`);
  url.searchParams.set('q', normalizedQuery);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ph');
  // Keep barangay/city searches away from POIs such as churches and bridges.
  if (!/\b(lot|block|street|st\.?|road|rd\.?)\b/i.test(normalizedQuery)) {
    url.searchParams.set('featureType', 'settlement');
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Location lookup failed (${response.status})`);

  const result = (await response.json()) as Array<{ lat?: string; lon?: string }>;
  const latitude = Number(result[0]?.lat);
  const longitude = Number(result[0]?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    cache[cacheKey] = null;
    writeCache(cache);
    return null;
  }

  const coordinate = { latitude, longitude };
  cache[cacheKey] = coordinate;
  writeCache(cache);
  return coordinate;
};

const straightLineDistanceMeters = (from: RouteCoordinate, to: RouteCoordinate) => {
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(from.latitude * radians) * Math.cos(to.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const coordinateKey = (coordinate: RouteCoordinate) => `${coordinate.latitude},${coordinate.longitude}`;
const pairKey = (from: RouteCoordinate, to: RouteCoordinate) => `${coordinateKey(from)}>${coordinateKey(to)}`;

/** One OSRM table request supplies driving distances between all route stops. */
export const getDrivingDistanceMatrix: RoadRouter = async coordinates => {
  if (coordinates.length < 2) return null;
  if (coordinates.length > 100) throw new Error('Too many stops for one road-routing request');

  const baseUrl = String(import.meta.env.VITE_ROUTING_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  const encodedCoordinates = coordinates.map(({ longitude, latitude }) => `${longitude},${latitude}`).join(';');
  const url = new URL(`${baseUrl}/table/v1/driving/${encodedCoordinates}`);
  url.searchParams.set('annotations', 'distance');

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Road routing failed (${response.status})`);
  const result = await response.json() as { code?: string; distances?: Array<Array<number | null>> };
  if (result.code !== 'Ok' || !Array.isArray(result.distances) || result.distances.length !== coordinates.length) {
    throw new Error('Road router returned an incomplete distance table');
  }
  return result.distances;
};

const nearestNeighborOrder = (
  labels: string[],
  coordinates: Map<string, RouteCoordinate>,
  startingPoint: RouteCoordinate | null,
  roadDistances: Map<string, number>
) => {
  const remaining = [...labels].sort(collator.compare);
  const ordered: string[] = [];
  let currentPoint = startingPoint;

  while (remaining.length > 0) {
    let nextIndex = 0;
    if (currentPoint) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      remaining.forEach((label, index) => {
        const coordinate = coordinates.get(locationKey(label));
        if (!coordinate) return;
        const distance = roadDistances.get(pairKey(currentPoint as RouteCoordinate, coordinate)) ??
          straightLineDistanceMeters(currentPoint as RouteCoordinate, coordinate);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nextIndex = index;
        }
      });
    }

    const [nextLabel] = remaining.splice(nextIndex, 1);
    ordered.push(nextLabel);
    currentPoint = coordinates.get(locationKey(nextLabel)) || currentPoint;
  }

  return { ordered, endingPoint: currentPoint };
};

const uniqueLabels = (values: string[]) => {
  const labels = new Map<string, string>();
  values.forEach(value => {
    const display = cleanLocationLabel(value, 'Unspecified');
    if (!labels.has(locationKey(display))) labels.set(locationKey(display), display);
  });
  return [...labels.values()];
};

const geocodeOriginWithFallback = async (
  originLabel: string,
  geocode: PlaceGeocoder
): Promise<{ coordinate: RouteCoordinate | null; resolvedAs: string | null }> => {
  const parts = cleanLocationLabel(originLabel, '').split(',').map(part => part.trim()).filter(Boolean);
  const candidates = [originLabel];
  for (let start = 1; start < parts.length; start += 1) {
    const suffix = parts.slice(start).join(', ');
    if (suffix && !candidates.some(candidate => locationKey(candidate) === locationKey(suffix))) {
      candidates.push(suffix);
    }
  }

  for (const candidate of candidates) {
    const query = /philippines/i.test(candidate) ? candidate : `${candidate}, Philippines`;
    const knownCoordinate = geocode === geocodeCollectionPlace ? getKnownOrmocCoordinate(query) : null;
    if (knownCoordinate) {
      const isOfficeAddress = locationKey(candidate).includes('lot 2 block 3');
      return {
        coordinate: knownCoordinate,
        resolvedAs: isOfficeAddress ? 'Brgy. San Isidro, Ormoc City (approximate barangay map point)' : candidate
      };
    }
    const coordinate = await geocode(query);
    if (coordinate) return { coordinate, resolvedAs: candidate };
  }

  return { coordinate: null, resolvedAs: null };
};

export const buildCollectionRoutePlan = async (
  loans: Loan[],
  originLabel: string,
  geocode: PlaceGeocoder = geocodeCollectionPlace,
  roadRouter: RoadRouter = getDrivingDistanceMatrix
): Promise<CollectionRoutePlan> => {
  const cities = uniqueLabels(loans.map(loan => loan.city));
  const unresolvedStops: string[] = [];
  const cityCoordinates = new Map<string, RouteCoordinate>();

  const resolvedOrigin = await geocodeOriginWithFallback(originLabel, geocode);
  const origin = resolvedOrigin.coordinate;
  if (!origin) unresolvedStops.push(originLabel);

  for (const city of cities) {
    // Include the province: city names by themselves (e.g. Isabel or Merida)
    // are ambiguous to geocoders and may resolve outside this service area.
    const coordinate = await geocode(`${city}, Leyte, Eastern Visayas, Philippines`);
    if (coordinate) cityCoordinates.set(locationKey(city), coordinate);
    else unresolvedStops.push(city);
  }

  const barangayCoordinatesByCity = new Map<string, Map<string, RouteCoordinate>>();
  const barangaysByCity = new Map<string, string[]>();
  for (const city of cities) {
    const cityLoans = loans.filter(loan => locationKey(cleanLocationLabel(loan.city, 'Unspecified')) === locationKey(city));
    const barangays = uniqueLabels(cityLoans.map(loan => loan.barangay));
    const barangayCoordinates = new Map<string, RouteCoordinate>();

    for (const barangay of barangays) {
      const coordinate = await geocode(`${barangay}, ${city}, Leyte, Eastern Visayas, Philippines`);
      if (coordinate) barangayCoordinates.set(locationKey(barangay), coordinate);
      else unresolvedStops.push(`${barangay}, ${city}`);
    }
    barangaysByCity.set(locationKey(city), barangays);
    barangayCoordinatesByCity.set(locationKey(city), barangayCoordinates);
  }

  const uniqueCoordinates = new Map<string, RouteCoordinate>();
  [origin, ...cityCoordinates.values(), ...[...barangayCoordinatesByCity.values()].flatMap(points => [...points.values()])]
    .filter((coordinate): coordinate is RouteCoordinate => Boolean(coordinate))
    .forEach(coordinate => uniqueCoordinates.set(coordinateKey(coordinate), coordinate));

  const roadDistances = new Map<string, number>();
  let routingMode: CollectionRoutePlan['routingMode'] = 'approximate';
  let routingWarning: string | null = null;
  if (uniqueCoordinates.size > 1) {
    try {
      const coordinateList = [...uniqueCoordinates.values()];
      const matrix = await roadRouter(coordinateList);
      if (matrix) {
        routingMode = 'road';
        matrix.forEach((row, fromIndex) => row.forEach((distance, toIndex) => {
          if (Number.isFinite(distance)) {
            roadDistances.set(pairKey(coordinateList[fromIndex], coordinateList[toIndex]), distance as number);
          } else if (fromIndex !== toIndex) {
            routingWarning = 'Some locations could not be connected by road data; straight-line distance was used for those comparisons.';
          }
        }));
      } else {
        routingWarning = 'Road routing was unavailable; straight-line distance was used instead.';
      }
    } catch {
      routingWarning = 'Road routing was unavailable; straight-line distance was used instead.';
    }
  }

  const cityRoute = nearestNeighborOrder(cities, cityCoordinates, origin, roadDistances);
  const barangayOrderByCity: Record<string, string[]> = {};
  let currentPoint = origin;
  for (const city of cityRoute.ordered) {
    const barangays = barangaysByCity.get(locationKey(city)) || [];
    const barangayCoordinates = barangayCoordinatesByCity.get(locationKey(city)) || new Map<string, RouteCoordinate>();

    const barangayRoute = nearestNeighborOrder(
      barangays,
      barangayCoordinates,
      currentPoint || cityCoordinates.get(locationKey(city)) || null,
      roadDistances
    );
    barangayOrderByCity[locationKey(city)] = barangayRoute.ordered;
    currentPoint = barangayRoute.endingPoint || cityCoordinates.get(locationKey(city)) || currentPoint;
  }

  return {
    cityOrder: cityRoute.ordered,
    barangayOrderByCity,
    unresolvedStops,
    originLabel,
    resolvedOriginLabel: resolvedOrigin.resolvedAs,
    routingMode,
    routingWarning
  };
};

