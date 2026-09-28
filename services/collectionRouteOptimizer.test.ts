import { describe, expect, it, vi } from 'vitest';
import { Branch, Loan } from '../types';
import {
  buildCollectionRoutePlan,
  cleanLocationLabel,
  geocodeCollectionPlace,
  getDrivingDistanceMatrix,
  getKnownOrmocCoordinate,
  locationKey
} from './collectionRouteOptimizer';

const loan = (city: string, barangay: string) => ({ city, barangay } as Loan);
const noRoadRouter = async () => null;

describe('collectionRouteOptimizer', () => {
  it('cleans labels and creates case-insensitive grouping keys', () => {
    expect(cleanLocationLabel('  Carigara   City ', 'Unknown')).toBe('Carigara City');
    expect(locationKey(' Carigara ')).toBe('carigara');
  });

  it('uses local Ormoc locality points instead of unstable point-of-interest geocoder matches', () => {
    expect(getKnownOrmocCoordinate('Lot 2 Block 3, Brgy. San Isidro, Ormoc City, Leyte, Philippines'))
      .toEqual({ latitude: 11.0259, longitude: 124.5947 });
    expect(getKnownOrmocCoordinate('Bagong Buhay, Ormoc City, Leyte, Philippines'))
      .toEqual({ latitude: 11.0302, longitude: 124.5936 });
    expect(getKnownOrmocCoordinate('Owak, Ormoc City, Leyte, Eastern Visayas, Philippines'))
      .toEqual({ latitude: 11.02679, longitude: 124.59195 });
    expect(getKnownOrmocCoordinate('Owak, Hilongos, Leyte, Philippines')).toBeNull();
  });

  it('restricts public locality lookups to settlement features', async () => {
    localStorage.clear();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: '11.2', lon: '124.5' }]
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(geocodeCollectionPlace('Visares, Capoocan, Leyte, Philippines'))
      .resolves.toEqual({ latitude: 11.2, longitude: 124.5 });
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get('featureType')).toBe('settlement');

    vi.unstubAllGlobals();
  });

  it('requests OSRM road distances for the route point matrix', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', distances: [[0, 1200], [1500, 0]] })
    });
    vi.stubGlobal('fetch', fetchMock);
    const matrix = await getDrivingDistanceMatrix([
      { latitude: 11, longitude: 124 },
      { latitude: 11.1, longitude: 124.1 }
    ]);

    expect(matrix).toEqual([[0, 1200], [1500, 0]]);
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toContain('/table/v1/driving/124,11;124.1,11.1');
    expect(requestUrl.searchParams.get('annotations')).toBe('distance');
    vi.unstubAllGlobals();
  });

  it('orders cities and barangays from the nearest next stop', async () => {
    const coordinates: Record<string, { latitude: number; longitude: number }> = {
      'office, philippines': { latitude: 0, longitude: 0 },
      'far city, leyte, eastern visayas, philippines': { latitude: 10, longitude: 0 },
      'near city, leyte, eastern visayas, philippines': { latitude: 1, longitude: 0 },
      'beta, near city, leyte, eastern visayas, philippines': { latitude: 3, longitude: 0 },
      'alpha, near city, leyte, eastern visayas, philippines': { latitude: 2, longitude: 0 },
      'center, far city, leyte, eastern visayas, philippines': { latitude: 10, longitude: 0 }
    };
    const geocode = vi.fn(async (query: string) => coordinates[query.toLocaleLowerCase()] || null);

    const plan = await buildCollectionRoutePlan([
      loan('Far City', 'Center'),
      loan('Near City', 'Beta'),
      loan('Near City', 'Alpha')
    ], 'Office', geocode, noRoadRouter);

    expect(plan.cityOrder).toEqual(['Near City', 'Far City']);
    expect(plan.barangayOrderByCity[locationKey('Near City')]).toEqual(['Alpha', 'Beta']);
    expect(plan.unresolvedStops).toEqual([]);
    expect(geocode).toHaveBeenCalledWith('Office, Philippines');
    expect(geocode).toHaveBeenCalledWith('Near City, Leyte, Eastern Visayas, Philippines');
    expect(geocode).toHaveBeenCalledWith('Alpha, Near City, Leyte, Eastern Visayas, Philippines');
  });

  it('keeps unresolved locations in deterministic alphabetical order', async () => {
    const plan = await buildCollectionRoutePlan([
      loan('Zulu', 'Bravo'),
      loan('Alpha', 'Charlie'),
      loan('Alpha', 'Able')
    ], Branch.ORMOC, async () => null, noRoadRouter);

    expect(plan.cityOrder).toEqual(['Alpha', 'Zulu']);
    expect(plan.barangayOrderByCity[locationKey('Alpha')]).toEqual(['Able', 'Charlie']);
    expect(plan.unresolvedStops).toContain(Branch.ORMOC);
  });

  it('falls back from an unrecognized office street address to its city before ordering cities', async () => {
    const coordinates: Record<string, { latitude: number; longitude: number }> = {
      'ormoc city, leyte, philippines': { latitude: 11.009, longitude: 124.609 },
      'barugo, leyte, eastern visayas, philippines': { latitude: 11.325, longitude: 124.735 },
      'carigara, leyte, eastern visayas, philippines': { latitude: 11.302, longitude: 124.687 },
      'poblacion, barugo, leyte, eastern visayas, philippines': { latitude: 11.325, longitude: 124.735 },
      'poblacion, carigara, leyte, eastern visayas, philippines': { latitude: 11.302, longitude: 124.687 }
    };
    const geocode = vi.fn(async (query: string) => coordinates[query.toLocaleLowerCase()] || null);

    const plan = await buildCollectionRoutePlan([
      loan('Barugo', 'Poblacion'),
      loan('Carigara', 'Poblacion')
    ], 'Lot 2 Block 3, Brgy. San Isidro, Ormoc City, Leyte', geocode, noRoadRouter);

    expect(plan.resolvedOriginLabel).toBe('Ormoc City, Leyte');
    expect(plan.cityOrder).toEqual(['Carigara', 'Barugo']);
    expect(geocode).toHaveBeenCalledWith('Lot 2 Block 3, Brgy. San Isidro, Ormoc City, Leyte, Philippines');
    expect(geocode).toHaveBeenCalledWith('Ormoc City, Leyte, Philippines');
  });

  it('orders cities and barangays by the supplied driving-distance matrix', async () => {
    const coordinates: Record<string, { latitude: number; longitude: number }> = {
      'office, philippines': { latitude: 0, longitude: 0 },
      'alpha, leyte, eastern visayas, philippines': { latitude: 1, longitude: 0 },
      'beta, leyte, eastern visayas, philippines': { latitude: 2, longitude: 0 },
      'one, alpha, leyte, eastern visayas, philippines': { latitude: 1.1, longitude: 0 },
      'zulu, beta, leyte, eastern visayas, philippines': { latitude: 2.1, longitude: 0 },
      'able, beta, leyte, eastern visayas, philippines': { latitude: 2.2, longitude: 0 }
    };
    const geocode = async (query: string) => coordinates[query.toLocaleLowerCase()] || null;
    const roadRouter = vi.fn(async (points: { latitude: number; longitude: number }[]) => points.map(from =>
      points.map(to => {
        if (from.latitude === 0 && to.latitude === 1) return 500;
        if (from.latitude === 0 && to.latitude === 2) return 100;
        if (from.latitude === 0 && to.latitude === 2.1) return 50;
        if (from.latitude === 0 && to.latitude === 2.2) return 300;
        return Math.abs(from.latitude - to.latitude) * 1000;
      })
    ));

    const plan = await buildCollectionRoutePlan([
      loan('Alpha', 'One'),
      loan('Beta', 'Able'),
      loan('Beta', 'Zulu')
    ], 'Office', geocode, roadRouter);

    expect(plan.cityOrder).toEqual(['Beta', 'Alpha']);
    expect(plan.barangayOrderByCity[locationKey('Beta')]).toEqual(['Zulu', 'Able']);
    expect(plan.routingMode).toBe('road');
    expect(roadRouter).toHaveBeenCalledOnce();
  });
});
