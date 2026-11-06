import React, { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  OPENFREEMAP_LIBERTY_STYLE,
  createGeoJSONCircle,
  isWebGLSupported,
} from "@/lib/map-utils";
import { AlertTriangle, MapPin, Loader2 } from "lucide-react";

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export interface MapLibreGeofenceMapProps {
  /** Center coordinates: [longitude, latitude] */
  center?: [number, number];
  zoom?: number;
  radiusMeters?: number;
  interactive?: boolean;
  markerDraggable?: boolean;
  onCoordinatesChange?: (coords: MapCoordinates) => void;
  officeLocations?: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radius_meters: number;
    is_active: boolean;
  }>;
  selectedLocationId?: string | null;
  onSelectLocation?: (id: string) => void;
  userLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
  } | null;
  /** Whether user is inside the geofence perimeter (controls dynamic circle coloring) */
  isInsideGeofence?: boolean | null;
  className?: string;
  height?: string | number;
}

const GEOFENCE_SOURCE_ID = "geofence-circle-source";
const GEOFENCE_FILL_LAYER_ID = "geofence-circle-fill";
const GEOFENCE_STROKE_LAYER_ID = "geofence-circle-stroke";

const USER_SOURCE_ID = "user-accuracy-source";
const USER_FILL_LAYER_ID = "user-accuracy-fill";
const USER_STROKE_LAYER_ID = "user-accuracy-stroke";

function getGeofenceColors(isInside?: boolean | null) {
  if (isInside === true) {
    return { fill: "#10b981", stroke: "#059669" };
  }
  if (isInside === false) {
    return { fill: "#f59e0b", stroke: "#d97706" };
  }
  return { fill: "#6366f1", stroke: "#4f46e5" };
}

export function MapLibreGeofenceMap({
  center = [73.8567, 18.5204], // Default Pune [lng, lat]
  zoom = 15.5,
  radiusMeters = 150,
  interactive = true,
  markerDraggable = true,
  onCoordinatesChange,
  officeLocations = [],
  selectedLocationId,
  onSelectLocation,
  userLocation,
  isInsideGeofence,
  className = "",
  height = "420px",
}: MapLibreGeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const primaryMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const officeMarkersMapRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const [mapLoaded, setMapLoaded] = useState(false);
  const [webGlAvailable, setWebGlAvailable] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Check WebGL availability on mount
  useEffect(() => {
    if (!isWebGLSupported()) {
      setWebGlAvailable(false);
    }
  }, []);

  // Update geofence GeoJSON layer
  const updateGeofenceLayer = useCallback(
    (coords: [number, number], radius: number) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      const circleData = createGeoJSONCircle(coords, radius);
      const source = map.getSource(GEOFENCE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      const colors = getGeofenceColors(isInsideGeofence);

      if (source) {
        source.setData(circleData);
      } else {
        map.addSource(GEOFENCE_SOURCE_ID, {
          type: "geojson",
          data: circleData,
        });

        // Semi-transparent boundary fill
        map.addLayer({
          id: GEOFENCE_FILL_LAYER_ID,
          type: "fill",
          source: GEOFENCE_SOURCE_ID,
          paint: {
            "fill-color": colors.fill,
            "fill-opacity": 0.2,
          },
        });

        // Solid accent boundary border
        map.addLayer({
          id: GEOFENCE_STROKE_LAYER_ID,
          type: "line",
          source: GEOFENCE_SOURCE_ID,
          paint: {
            "line-color": colors.stroke,
            "line-width": 2.5,
            "line-dasharray": [3, 2],
          },
        });
      }
    },
    [isInsideGeofence]
  );

  // Sync color changes dynamically when inside/outside status flips
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;

    const colors = getGeofenceColors(isInsideGeofence);
    if (map.getLayer(GEOFENCE_FILL_LAYER_ID)) {
      map.setPaintProperty(GEOFENCE_FILL_LAYER_ID, "fill-color", colors.fill);
    }
    if (map.getLayer(GEOFENCE_STROKE_LAYER_ID)) {
      map.setPaintProperty(GEOFENCE_STROKE_LAYER_ID, "line-color", colors.stroke);
    }
  }, [isInsideGeofence, mapLoaded]);

  // Update user location accuracy circle
  const updateUserAccuracyLayer = useCallback(
    (coords: [number, number], accuracy: number) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;

      const userCircle = createGeoJSONCircle(coords, Math.max(accuracy, 10));
      const source = map.getSource(USER_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

      if (source) {
        source.setData(userCircle);
      } else {
        map.addSource(USER_SOURCE_ID, {
          type: "geojson",
          data: userCircle,
        });

        map.addLayer({
          id: USER_FILL_LAYER_ID,
          type: "fill",
          source: USER_SOURCE_ID,
          paint: {
            "fill-color": "#0ea5e9",
            "fill-opacity": 0.15,
          },
        });

        map.addLayer({
          id: USER_STROKE_LAYER_ID,
          type: "line",
          source: USER_SOURCE_ID,
          paint: {
            "line-color": "#0284c7",
            "line-width": 1.5,
          },
        });
      }
    },
    []
  );

  // Initialize MapLibre GL
  useEffect(() => {
    if (!containerRef.current || !webGlAvailable || mapRef.current) return;

    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: OPENFREEMAP_LIBERTY_STYLE,
        center: center,
        zoom: zoom,
        attributionControl: false, // We'll add custom attribution
      });

      // Controls
      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: "metric" }), "bottom-left");
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: "© OpenFreeMap • © OpenStreetMap contributors",
        }),
        "bottom-right"
      );

      // Create primary draggable office marker element
      const el = document.createElement("div");
      el.className = "flowpeople-office-marker";
      el.innerHTML = `
        <div style="
          position: relative;
          cursor: ${markerDraggable ? "grab" : "pointer"};
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          background: #4f46e5;
          color: white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.45);
          border: 2.5px solid #ffffff;
        ">
          <svg style="transform: rotate(45deg); width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      `;

      const marker = new maplibregl.Marker({
        element: el,
        draggable: markerDraggable,
      })
        .setLngLat(center)
        .addTo(map);

      primaryMarkerRef.current = marker;

      // Drag event listeners
      if (markerDraggable) {
        marker.on("drag", () => {
          const lngLat = marker.getLngLat();
          updateGeofenceLayer([lngLat.lng, lngLat.lat], radiusMeters);
        });

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          updateGeofenceLayer([lngLat.lng, lngLat.lat], radiusMeters);
          onCoordinatesChange?.({ lat: lngLat.lat, lng: lngLat.lng });
        });
      }

      // Click on map to select position
      if (interactive) {
        map.on("click", (e) => {
          const { lng, lat } = e.lngLat;
          marker.setLngLat([lng, lat]);
          updateGeofenceLayer([lng, lat], radiusMeters);
          onCoordinatesChange?.({ lat, lng });
        });
      }

      // Map loaded event
      map.on("load", () => {
        setMapLoaded(true);
        updateGeofenceLayer(center, radiusMeters);
      });

      map.on("error", (e) => {
        console.warn("MapLibre tile or render warning:", e);
      });

      mapRef.current = map;
    } catch (err: unknown) {
      console.error("Failed to initialize MapLibre GL map:", err);
      setMapError(err instanceof Error ? err.message : "Failed to load map container");
    }

    // Resize observer to prevent gray tile lag
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.resize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, interactive, markerDraggable, onCoordinatesChange, radiusMeters, updateGeofenceLayer, webGlAvailable, zoom]);

  // Sync external center and radius updates to existing map
  useEffect(() => {
    const map = mapRef.current;
    const marker = primaryMarkerRef.current;
    if (!map || !marker) return;

    const currentPos = marker.getLngLat();
    const diffLng = Math.abs(currentPos.lng - center[0]);
    const diffLat = Math.abs(currentPos.lat - center[1]);

    // Only update if difference is meaningful
    if (diffLng > 0.00001 || diffLat > 0.00001) {
      marker.setLngLat(center);
      map.flyTo({ center, duration: 800 });
    }

    updateGeofenceLayer(center, radiusMeters);
  }, [center, radiusMeters, updateGeofenceLayer]);

  // Render secondary office location markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // Remove old secondary markers
    officeMarkersMapRef.current.forEach((m) => m.remove());
    officeMarkersMapRef.current.clear();

    officeLocations.forEach((loc) => {
      // Skip the selected primary office (already has the primary interactive marker)
      if (selectedLocationId && loc.id === selectedLocationId) return;

      const secEl = document.createElement("div");
      secEl.className = "flowpeople-secondary-office-marker";
      secEl.innerHTML = `
        <div style="
          cursor: pointer;
          width: 26px;
          height: 26px;
          background: #3b82f6;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">
          <svg style="width: 13px; height: 13px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
          </svg>
        </div>
      `;

      secEl.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectLocation?.(loc.id);
      });

      const m = new maplibregl.Marker({ element: secEl })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(
          new maplibregl.Popup({ offset: 20 }).setHTML(
            `<strong style="font-size: 12px; font-family: sans-serif;">${loc.name}</strong><br/>
             <span style="font-size: 11px; color: #64748b; font-family: sans-serif;">Radius: ${loc.radius_meters}m</span>`
          )
        )
        .addTo(map);

      officeMarkersMapRef.current.set(loc.id, m);
    });
  }, [mapLoaded, officeLocations, onSelectLocation, selectedLocationId]);

  // Render Employee's live GPS location marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }

    const userCoords: [number, number] = [userLocation.lng, userLocation.lat];

    if (!userMarkerRef.current) {
      const userDot = document.createElement("div");
      userDot.className = "flowpeople-user-live-dot";
      userDot.innerHTML = `
        <div style="
          position: relative;
          width: 20px;
          height: 20px;
          background: #0ea5e9;
          border-radius: 50%;
          border: 3px solid #ffffff;
          box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.35);
        ">
        </div>
      `;

      userMarkerRef.current = new maplibregl.Marker({ element: userDot })
        .setLngLat(userCoords)
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat(userCoords);
    }

    if (userLocation.accuracy) {
      updateUserAccuracyLayer(userCoords, userLocation.accuracy);
    }
  }, [mapLoaded, updateUserAccuracyLayer, userLocation]);

  // WebGL Unsupported Fallback
  if (!webGlAvailable) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 border rounded-2xl bg-muted/40 text-center ${className}`}
        style={{ height }}
      >
        <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
        <h4 className="text-sm font-semibold text-foreground">WebGL Hardware Acceleration Unavailable</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm">
          Interactive 3D map rendering requires WebGL. You can still view, enter, and adjust coordinates
          and geofence radius manually in the location fields below.
        </p>
        <div className="mt-3 text-xs font-mono bg-background p-2 rounded-lg border">
          Center: {center[1].toFixed(5)}° N, {center[0].toFixed(5)}° E (Radius: {radiusMeters}m)
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border bg-muted/20 ${className}`}>
      {/* Map Canvas Container */}
      <div ref={containerRef} style={{ width: "100%", height }} />

      {/* Loading overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-xs z-10">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Loading OpenFreeMap tiles...</span>
          </div>
        </div>
      )}

      {/* Map Tile Error Notice (non-fatal) */}
      {mapError && (
        <div className="absolute top-3 left-3 right-3 p-2 bg-destructive/10 border border-destructive/30 rounded-xl text-xs text-destructive flex items-center gap-2 z-20">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Map tile loading encountered an issue. Manual coordinates entry remains fully functional.</span>
        </div>
      )}

      {/* Legend Badge Overlay */}
      <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border text-[10px] text-muted-foreground flex items-center gap-2.5 shadow-xs z-10 pointer-events-none">
        <span className="flex items-center gap-1 font-medium text-foreground">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span> Office Pin
        </span>
        <span className="flex items-center gap-1 font-medium text-foreground">
          <span
            className={`w-2.5 h-2.5 rounded-full border border-dashed inline-block ${
              isInsideGeofence === true
                ? "border-emerald-600 bg-emerald-500/30"
                : isInsideGeofence === false
                ? "border-amber-600 bg-amber-500/30"
                : "border-indigo-600 bg-indigo-500/30"
            }`}
          ></span>{" "}
          Geofence ({radiusMeters}m)
        </span>
        {userLocation && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block"></span> Your GPS
          </span>
        )}
      </div>
    </div>
  );
}
