import { corsHeaders } from "../_shared/cors.ts";

interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  city?: string;
  region?: string;
  country?: string;
  source: string;
  timestamp: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Check Cloudflare / Edge headers if available
    const cfLat = req.headers.get("cf-iplatitude");
    const cfLon = req.headers.get("cf-iplongitude");
    const cfCity = req.headers.get("cf-ipcity");
    const cfRegion = req.headers.get("cf-region");
    const cfCountry = req.headers.get("cf-ipcountry");

    if (cfLat && cfLon) {
      const result: LocationResult = {
        latitude: parseFloat(cfLat),
        longitude: parseFloat(cfLon),
        accuracy: 75,
        city: cfCity || undefined,
        region: cfRegion || undefined,
        country: cfCountry || undefined,
        source: "cloudflare_edge_headers",
        timestamp: Date.now(),
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 2. Fallback to client IP lookup
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip");

    let ipGeoUrl = "https://freeipapi.com/api/json";
    if (clientIp && !clientIp.startsWith("127.") && !clientIp.startsWith("192.168.")) {
      ipGeoUrl = `https://freeipapi.com/api/json/${clientIp}`;
    }

    const geoRes = await fetch(ipGeoUrl, {
      headers: { "User-Agent": "FlowPeople-HRMS/1.0" },
    });

    if (geoRes.ok) {
      const geo = await geoRes.json();
      if (geo.latitude && geo.longitude) {
        const result: LocationResult = {
          latitude: parseFloat(geo.latitude),
          longitude: parseFloat(geo.longitude),
          accuracy: 80,
          city: geo.cityName || undefined,
          region: geo.regionName || undefined,
          country: geo.countryName || undefined,
          source: "ip_network_lookup",
          timestamp: Date.now(),
        };

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
    }

    // Default fallback to central coordinates
    return new Response(
      JSON.stringify({
        latitude: 18.5204,
        longitude: 73.8567,
        accuracy: 100,
        city: "Pune",
        country: "India",
        source: "default_fallback",
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});

