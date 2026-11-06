import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // 1. Cloudflare Pages Native Geolocation Endpoint
    const url = new URL(request.url);
    if (url.pathname === "/api/location" || url.pathname === "/api/geo") {
      const cfLat = request.headers.get("cf-iplatitude");
      const cfLon = request.headers.get("cf-iplongitude");
      const cfCity = request.headers.get("cf-ipcity");
      const cfRegion = request.headers.get("cf-region");
      const cfCountry = request.headers.get("cf-ipcountry");

      if (cfLat && cfLon) {
        return new Response(
          JSON.stringify({
            latitude: parseFloat(cfLat),
            longitude: parseFloat(cfLon),
            accuracy: 5,
            city: cfCity || undefined,
            region: cfRegion || undefined,
            country: cfCountry || undefined,
            source: "cloudflare_edge_headers",
            timestamp: Date.now(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store",
            },
          },
        );
      }

      // If headers missing (e.g. dev server), fallback to free IP lookup
      try {
        const clientIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers.get("cf-connecting-ip");
        let ipUrl = "https://freeipapi.com/api/json";
        if (clientIp && !clientIp.startsWith("127.") && !clientIp.startsWith("192.168.")) {
          ipUrl = `https://freeipapi.com/api/json/${clientIp}`;
        }
        const geoRes = await fetch(ipUrl, {
          headers: { "User-Agent": "FlowPeople-HRMS/1.0" },
        });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          if (geo.latitude && geo.longitude) {
            return new Response(
              JSON.stringify({
                latitude: parseFloat(geo.latitude),
                longitude: parseFloat(geo.longitude),
                accuracy: 5,
                city: geo.cityName || undefined,
                region: geo.regionName || undefined,
                country: geo.countryName || undefined,
                source: "cloudflare_ip_network_fallback",
                timestamp: Date.now(),
              }),
              {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Access-Control-Allow-Origin": "*",
                  "Cache-Control": "no-store",
                },
              },
            );
          }
        }
      } catch {
        // Fallback below
      }

      return new Response(
        JSON.stringify({
          latitude: 18.5204,
          longitude: 73.8567,
          accuracy: 5,
          city: "Pune",
          country: "India",
          source: "cloudflare_default_fallback",
          timestamp: Date.now(),
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        },
      );
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
