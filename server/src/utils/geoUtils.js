/**
 * Geospatial utility functions for farm and field boundary mapping.
 * Handles GeoJSON Polygon validation, geodesic spherical area calculation,
 * boundary perimeter calculation, and centroid extraction.
 */

const EARTH_RADIUS_METERS = 6378137;
const SQ_METERS_TO_HECTARES = 1 / 10000;
const HECTARES_TO_ACRES = 2.4710538146717;

const toRadians = (deg) => (deg * Math.PI) / 180;
const toDegrees = (rad) => (rad * 180) / Math.PI;

/**
 * Validates a GeoJSON Polygon geometry.
 * @param {object} boundary - GeoJSON Polygon object { type: 'Polygon', coordinates: [...] }
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateGeoJSONPolygon = (boundary) => {
  if (!boundary || typeof boundary !== 'object') {
    return { valid: false, error: 'Boundary must be a valid GeoJSON object.' };
  }

  if (boundary.type !== 'Polygon') {
    return { valid: false, error: 'Boundary geometry type must be "Polygon".' };
  }

  if (!Array.isArray(boundary.coordinates) || boundary.coordinates.length === 0) {
    return { valid: false, error: 'Polygon coordinates array cannot be empty.' };
  }

  const linearRing = boundary.coordinates[0];
  if (!Array.isArray(linearRing) || linearRing.length < 4) {
    return {
      valid: false,
      error: 'Polygon outer linear ring must contain at least 4 coordinate positions (triangle + closing vertex).',
    };
  }

  // Validate each coordinate pair
  for (let i = 0; i < linearRing.length; i++) {
    const coord = linearRing[i];
    if (!Array.isArray(coord) || coord.length < 2) {
      return {
        valid: false,
        error: `Coordinate at index ${i} is invalid. Expected [longitude, latitude].`,
      };
    }

    const [lng, lat] = coord;
    if (typeof lng !== 'number' || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      return {
        valid: false,
        error: `Longitude at index ${i} (${lng}) is invalid. Must be between -180 and 180 degrees.`,
      };
    }

    if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      return {
        valid: false,
        error: `Latitude at index ${i} (${lat}) is invalid. Must be between -90 and 90 degrees.`,
      };
    }
  }

  // Validate ring closure: first position must be identical to last position
  const first = linearRing[0];
  const last = linearRing[linearRing.length - 1];
  const tolerance = 1e-7;
  if (Math.abs(first[0] - last[0]) > tolerance || Math.abs(first[1] - last[1]) > tolerance) {
    return {
      valid: false,
      error: 'Polygon linear ring must be closed: the first and last coordinates must be identical.',
    };
  }

  return { valid: true };
};

/**
 * Calculates the approximate geodesic spherical surface area of a polygon in square meters,
 * hectares, and acres using spherical excess (WGS84).
 * @param {Array<Array<[number, number]>>} coordinates - GeoJSON coordinates array
 * @returns {{ squareMeters: number, hectares: number, acres: number }}
 */
export const calculatePolygonArea = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { squareMeters: 0, hectares: 0, acres: 0 };
  }

  const ring = coordinates[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    return { squareMeters: 0, hectares: 0, acres: 0 };
  }

  let totalExcess = 0;
  const n = ring.length - 1;

  for (let i = 0; i < n; i++) {
    const prev = i === 0 ? ring[n - 1] : ring[i - 1];
    const curr = ring[i];
    const next = ring[i + 1];

    const deltaLng = toRadians(next[0]) - toRadians(prev[0]);
    const sinLat = Math.sin(toRadians(curr[1]));

    totalExcess += deltaLng * sinLat;
  }

  const squareMeters = Math.abs((totalExcess * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
  const hectares = squareMeters * SQ_METERS_TO_HECTARES;
  const acres = hectares * HECTARES_TO_ACRES;

  return {
    squareMeters: Number(squareMeters.toFixed(2)),
    hectares: Number(hectares.toFixed(4)),
    acres: Number(acres.toFixed(4)),
  };
};

/**
 * Calculates geodesic distance between two [lng, lat] positions in meters (Haversine formula).
 * @param {[number, number]} p1 - [longitude, latitude]
 * @param {[number, number]} p2 - [longitude, latitude]
 * @returns {number} Distance in meters
 */
export const calculateHaversineDistance = (p1, p2) => {
  const [lng1, lat1] = p1;
  const [lng2, lat2] = p2;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

/**
 * Calculates the approximate perimeter of a polygon linear ring in meters and kilometers.
 * @param {Array<Array<[number, number]>>} coordinates - GeoJSON coordinates array
 * @returns {{ meters: number, kilometers: number }}
 */
export const calculatePolygonPerimeter = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { meters: 0, kilometers: 0 };
  }

  const ring = coordinates[0];
  if (!Array.isArray(ring) || ring.length < 2) {
    return { meters: 0, kilometers: 0 };
  }

  let totalMeters = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    totalMeters += calculateHaversineDistance(ring[i], ring[i + 1]);
  }

  return {
    meters: Number(totalMeters.toFixed(2)),
    kilometers: Number((totalMeters / 1000).toFixed(4)),
  };
};

/**
 * Computes the center (centroid approximation / bounding box midpoint) of a polygon.
 * @param {Array<Array<[number, number]>>} coordinates - GeoJSON coordinates array
 * @returns {{ latitude: number, longitude: number }}
 */
export const calculatePolygonCenter = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  const ring = coordinates[0];
  if (!Array.isArray(ring) || ring.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    latitude: Number(((minLat + maxLat) / 2).toFixed(6)),
    longitude: Number(((minLng + maxLng) / 2).toFixed(6)),
  };
};

/**
 * Computes the bounding box of a polygon [[minLng, minLat], [maxLng, maxLat]].
 * @param {Array<Array<[number, number]>>} coordinates - GeoJSON coordinates array
 * @returns {[[number, number], [number, number]]}
 */
export const calculatePolygonBoundingBox = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return [[0, 0], [0, 0]];
  }

  const ring = coordinates[0];
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (let i = 0; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
};
