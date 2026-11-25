// ==============================================================================
// FLOWPEOPLE — send-notification Edge Function
// Supports Email (Resend) and WhatsApp (Twilio/Meta) with strict provider confirmation
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

interface NotificationPayload {
  notification_id?: string;
  user_id: string;
  organization_id?: string;
  employee_id?: string;
  title: string;
  message: string;
  link?: string;
  type?: string;
  priority?: string;
  channel?: "in_app" | "email" | "whatsapp";
  recipient_email?: string;
  recipient_phone?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotificationPayload = await req.json();
    const {
      notification_id,
      user_id,
      organization_id,
      employee_id,
      title,
      message,
      link,
      type = "general",
      priority = "normal",
      channel = "in_app",
      recipient_email,
      recipient_phone,
    } = body;

    let deliveryStatus = "pending";
    let providerMessageId: string | null = null;
    let deliveryError: string | null = null;

    // Handle External Delivery Channels
    if (channel === "email") {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) {
        deliveryStatus = "failed";
        deliveryError = "Missing Resend API key (RESEND_API_KEY) in edge environment";
      } else if (!recipient_email) {
        deliveryStatus = "failed";
        deliveryError = "Recipient email address not provided";
      } else {
        const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "FlowPeople Alerts <notifications@flowpeople.internal>";
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient_email],
            subject: title,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <div style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 12px;">${title}</div>
                <p style="font-size: 14px; color: #475569; line-height: 1.6;">${message}</p>
                ${link ? `<div style="margin-top: 20px;"><a href="${link}" style="background-color: #3b82f6; color: white; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: bold; display: inline-block;">View in FlowPeople</a></div>` : ""}
                <hr style="margin-top: 32px; border: none; border-top: 1px solid #e2e8f0;" />
                <div style="font-size: 11px; color: #94a3b8; text-align: center;">FlowPeople HRMS • Confidential</div>
              </div>
            `,
          }),
        });

        const resData = await emailRes.json();
        if (emailRes.ok && resData.id) {
          deliveryStatus = "delivered";
          providerMessageId = resData.id;
        } else {
          deliveryStatus = "failed";
          deliveryError = resData.message || "Failed to deliver email via Resend";
        }
      }
    } else if (channel === "whatsapp") {
      const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
      const fromNumber = Deno.env.get("TWILIO_WHATSAPP_NUMBER");

      if (!twilioSid || !twilioAuth || !fromNumber) {
        deliveryStatus = "failed";
        deliveryError = "Missing WhatsApp provider credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)";
      } else if (!recipient_phone) {
        deliveryStatus = "failed";
        deliveryError = "Recipient phone number not provided";
      } else {
        const authHeader = btoa(`${twilioSid}:${twilioAuth}`);
        const formData = new URLSearchParams();
        formData.append("From", `whatsapp:${fromNumber}`);
        formData.append("To", `whatsapp:${recipient_phone}`);
        formData.append("Body", `*FlowPeople Alert: ${title}*\n\n${message}${link ? `\n\nLink: ${link}` : ""}`);

        const waRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${authHeader}`,
            },
            body: formData.toString(),
          }
        );

        const waData = await waRes.json();
        if (waRes.ok && waData.sid) {
          deliveryStatus = "delivered";
          providerMessageId = waData.sid;
        } else {
          deliveryStatus = "failed";
          deliveryError = waData.message || "Twilio WhatsApp delivery failed";
        }
      }
    } else {
      // In-app
      deliveryStatus = "delivered";
      providerMessageId = `in_app_${Date.now()}`;
    }

    // Persist or update notification in public.notifications
    let finalId = notification_id;

    if (notification_id) {
      const { error: updateErr } = await supabase
        .from("notifications")
        .update({
          delivery_status: deliveryStatus,
          provider_message_id: providerMessageId,
          metadata: {
            delivery_error: deliveryError,
            attempted_at: new Date().toISOString(),
          },
        })
        .eq("id", notification_id);

      if (updateErr) console.error("Error updating notification record:", updateErr);
    } else {
      const { data: newNotif, error: insertErr } = await supabase
        .from("notifications")
        .insert({
          user_id,
          organization_id: organization_id || null,
          employee_id: employee_id || null,
          title,
          message,
          link: link || null,
          type,
          priority,
          channel,
          delivery_status: deliveryStatus,
          provider_message_id: providerMessageId,
          metadata: {
            delivery_error: deliveryError,
            attempted_at: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (insertErr) console.error("Error inserting notification:", insertErr);
      if (newNotif) finalId = newNotif.id;
    }

    return new Response(
      JSON.stringify({
        success: deliveryStatus === "delivered",
        notification_id: finalId,
        delivery_status: deliveryStatus,
        provider_message_id: providerMessageId,
        error: deliveryError,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal server error in notification dispatcher",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
