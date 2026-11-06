/**
 * FlowPeople HRMS — Map & Geocoding Utilities
 * Provider: OpenFreeMap + MapLibre GL JS (Free, Open, No API Key Required)
 * Style: https://tiles.openfreemap.org/styles/liberty
 */

export const OPENFREEMAP_LIBERTY_STYLE =
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_MAP_STYLE_URL"]) ||
  (typeof process !== "undefined" && process.env?.["VITE_MAP_STYLE_URL"]) ||
  "https://tiles.openfreemap.org/styles/liberty";

/**
 * Universal OpenStreetMap raster tile style specification.
 * Used as a fast, zero-dependency fallback when remote vector tile servers
 * or glyphs/fonts are slow, blocked, or unreachable.
 */
export const OSM_RASTER_FALLBACK_STYLE = {
  version: 8 as const,
  sources: {
    "osm-raster-tiles": {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster" as const,
      source: "osm-raster-tiles",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

/**
 * Checks whether the current device/browser environment supports WebGL
 */
export function isWebGLSupported(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

export interface GeoJSONPolygonFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: [number, number][][];
  };
  properties: {
    radius: number;
    centerLat: number;
    centerLng: number;
  };
}

/**
 * Generates a standard GeoJSON Polygon feature representing a circular geofence
 * perimeter around a center coordinate [longitude, latitude].
 *
 * @param center [longitude, latitude] in WGS-84 decimal degrees
 * @param radiusInMeters Circular perimeter radius in meters
 * @param points Number of polygon vertices (default 64 for smooth circle)
 */
export function createGeoJSONCircle(
  center: [number, number],
  radiusInMeters: number,
  points: number = 64,
): GeoJSONPolygonFeature {
  const [lng, lat] = center;
  const coordinates: [number, number][] = [];

  // Approximate meters per degree longitude and latitude at given latitude
  const latRad = (lat * Math.PI) / 180.0;
  const metersPerDegLat =
    111132.954 - 559.822 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const metersPerDegLng = 111412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);

  const deltaLat = radiusInMeters / metersPerDegLat;
  const deltaLng = radiusInMeters / metersPerDegLng;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const pointLng = lng + deltaLng * Math.cos(theta);
    const pointLat = lat + deltaLat * Math.sin(theta);
    coordinates.push([pointLng, pointLat]);
  }

  // Close the polygon
  const firstPoint = coordinates[0];
  if (firstPoint) {
    coordinates.push(firstPoint);
  }

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
    },
    properties: {
      radius: radiusInMeters,
      centerLat: lat,
      centerLng: lng,
    },
  };
}

export interface GeocodingResult {
  placeId: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * Searches an address or landmark using OpenStreetMap Nominatim.
 * Strictly adheres to OSM usage policies:
 * - Proper User-Agent header
 * - Single request per user action (debounced)
 * - Safe error handling with zero throw crashes
 */
export async function searchAddressWithOSM(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3) return [];

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("addressdetails", "1");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "FlowPeople-HRMS/1.0 (contact: admin@fluxora.com)",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("OSM Nominatim returned non-OK status:", response.status);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => ({
      placeId: String(item.place_id || Math.random()),
      displayName: item.display_name || item.name || query,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
    }));
  } catch (err: unknown) {
    console.warn("Address search non-fatal fallback:", err);
    return [];
  }
}
