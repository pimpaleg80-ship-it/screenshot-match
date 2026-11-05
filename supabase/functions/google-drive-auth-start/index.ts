import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!clientId) {
      return new Response(
        JSON.stringify({ error: "Missing GOOGLE_CLIENT_ID secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine redirect URI
    // Defaults to supabase edge function callback URL or explicit GOOGLE_REDIRECT_URI secret
    const explicitRedirect = Deno.env.get("GOOGLE_REDIRECT_URI");
    const redirectUri =
      explicitRedirect ||
      `${supabaseUrl?.replace(/\/+$/, "")}/functions/v1/google-drive-auth-callback`;

    // Parse state from request if present (app return URL or admin user ID)
    const url = new URL(req.url);
    const returnUrl = url.searchParams.get("return_to") || req.headers.get("referer") || "/settings";
    const state = btoa(JSON.stringify({ return_to: returnUrl }));

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    googleAuthUrl.searchParams.set("client_id", clientId);
    googleAuthUrl.searchParams.set("redirect_uri", redirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email"
    );
    googleAuthUrl.searchParams.set("access_type", "offline");
    googleAuthUrl.searchParams.set("prompt", "consent");
    googleAuthUrl.searchParams.set("state", state);

    // If client requested JSON via Accept header or POST
    const acceptsJson = req.headers.get("accept")?.includes("application/json") || req.method === "POST";
    if (acceptsJson) {
      return new Response(
        JSON.stringify({ url: googleAuthUrl.toString(), redirect_uri: redirectUri }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Direct browser navigation: redirect 302
    return Response.redirect(googleAuthUrl.toString(), 302);
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to start Google Drive auth" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
