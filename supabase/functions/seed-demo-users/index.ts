import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify requesting user is admin if authorization header present
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await adminClient.auth.getUser(token);
      if (user) {
        const { data: roles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin");
        if (!roles || roles.length === 0) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Admin access required" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const demoUsers = [
      { email: "admin@demo.com", name: "Aarav Admin", role: "admin", code: "EMP001", dept: "Engineering", designation: "System Administrator" },
      { email: "manager1@demo.com", name: "Meera Manager", role: "manager", code: "EMP002", dept: "Engineering", designation: "Engineering Manager" },
      { email: "manager2@demo.com", name: "Rohan Manager", role: "manager", code: "EMP003", dept: "Sales", designation: "Sales Lead" },
      { email: "emp1@demo.com", name: "Priya Sharma", role: "employee", code: "EMP004", dept: "Engineering", designation: "Software Engineer", managerCode: "EMP002" },
      { email: "emp2@demo.com", name: "Amit Verma", role: "employee", code: "EMP005", dept: "Engineering", designation: "Frontend Engineer", managerCode: "EMP002" },
      { email: "emp3@demo.com", name: "Sneha Patil", role: "employee", code: "EMP006", dept: "Sales", designation: "Account Executive", managerCode: "EMP003" },
      { email: "emp4@demo.com", name: "Karan Joshi", role: "employee", code: "EMP007", dept: "Sales", designation: "Sales Representative", managerCode: "EMP003" },
      { email: "emp5@demo.com", name: "Neha Kulkarni", role: "employee", code: "EMP008", dept: "HR", designation: "HR Associate" },
    ];

    const results = [];
    for (const u of demoUsers) {
      // Find or create user
      const { data: listData } = await adminClient.auth.admin.listUsers();
      let user = listData?.users.find((x) => x.email === u.email);

      if (!user) {
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email: u.email,
          password: "Demo@12345",
          email_confirm: true,
          user_metadata: { name: u.name },
          app_metadata: { role: u.role },
        });
        if (createErr) throw createErr;
        user = created.user;
      } else {
        await adminClient.auth.admin.updateUserById(user.id, {
          password: "Demo@12345",
          email_confirm: true,
          user_metadata: { name: u.name },
          app_metadata: { role: u.role },
        });
      }

      // Upsert role
      await adminClient
        .from("user_roles")
        .upsert({ user_id: user.id, role: u.role }, { onConflict: "user_id,role" });

      results.push({ email: u.email, id: user.id, role: u.role });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Demo users ready", users: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

