// =============================================================================
// AUTO-ARCHIVE EDGE FUNCTION
// Automatische Archivierung von alten Daten
// Wird monatlich per Cron ausgeführt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ArchiveSettings {
  is_enabled: boolean;
  leads_retention_days: number;
  offers_retention_days: number;
  email_logs_retention_days: number;
  notifications_retention_days: number;
  appointments_retention_days: number;
  notify_on_archive: boolean;
  notify_email?: string;
}

interface ArchiveResult {
  type: string;
  records_archived: number;
  records_deleted: number;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🗄️ Starting auto-archive process...");

    // Fetch archive settings
    const { data: settingsData, error: settingsError } = await supabase
      .from("archive_settings")
      .select("*")
      .single();

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
      return new Response(
        JSON.stringify({ success: false, error: "Settings nicht gefunden" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = settingsData as ArchiveSettings;

    // Check if archiving is enabled
    if (!settings.is_enabled) {
      console.log("⏸️ Auto-archive is disabled");
      return new Response(
        JSON.stringify({ success: true, message: "Auto-Archivierung ist deaktiviert" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ArchiveResult[] = [];
    const now = new Date();

    // =======================================================================
    // Archive Leads
    // =======================================================================
    try {
      const leadsCutoff = new Date(now);
      leadsCutoff.setDate(leadsCutoff.getDate() - settings.leads_retention_days);

      // Fetch archivable leads
      const { data: leads, error: leadsError } = await supabase
        .from("leads")
        .select("*")
        .lt("created_at", leadsCutoff.toISOString())
        .in("status", ["completed", "cancelled", "expired", "rejected"]);

      if (leadsError) throw leadsError;

      if (leads && leads.length > 0) {
        // Store in archive_snapshots
        const { error: snapshotError } = await supabase
          .from("archive_snapshots")
          .insert({
            archive_log_id: null, // Will be linked later
            data: leads,
            record_count: leads.length,
            checksum: generateChecksum(JSON.stringify(leads)),
          });

        if (snapshotError) {
          console.warn("Snapshot error:", snapshotError);
        }

        // Delete archived leads
        const { error: deleteError } = await supabase
          .from("leads")
          .delete()
          .lt("created_at", leadsCutoff.toISOString())
          .in("status", ["completed", "cancelled", "expired", "rejected"]);

        results.push({
          type: "leads",
          records_archived: leads.length,
          records_deleted: deleteError ? 0 : leads.length,
          success: !deleteError,
          error: deleteError?.message,
        });

        console.log(`✅ Leads archived: ${leads.length}`);
      } else {
        results.push({
          type: "leads",
          records_archived: 0,
          records_deleted: 0,
          success: true,
        });
      }
    } catch (error) {
      console.error("Leads archive error:", error);
      results.push({
        type: "leads",
        records_archived: 0,
        records_deleted: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // =======================================================================
    // Archive Email Logs
    // =======================================================================
    try {
      const emailCutoff = new Date(now);
      emailCutoff.setDate(emailCutoff.getDate() - settings.email_logs_retention_days);

      const { data: emails, error: emailsError } = await supabase
        .from("email_logs")
        .select("*")
        .lt("created_at", emailCutoff.toISOString());

      if (emailsError) throw emailsError;

      if (emails && emails.length > 0) {
        // Store snapshot
        await supabase
          .from("archive_snapshots")
          .insert({
            data: emails,
            record_count: emails.length,
            checksum: generateChecksum(JSON.stringify(emails)),
          });

        // Delete
        const { error: deleteError } = await supabase
          .from("email_logs")
          .delete()
          .lt("created_at", emailCutoff.toISOString());

        results.push({
          type: "email_logs",
          records_archived: emails.length,
          records_deleted: deleteError ? 0 : emails.length,
          success: !deleteError,
          error: deleteError?.message,
        });

        console.log(`✅ Email logs archived: ${emails.length}`);
      } else {
        results.push({
          type: "email_logs",
          records_archived: 0,
          records_deleted: 0,
          success: true,
        });
      }
    } catch (error) {
      console.error("Email logs archive error:", error);
      results.push({
        type: "email_logs",
        records_archived: 0,
        records_deleted: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // =======================================================================
    // Archive Notifications
    // =======================================================================
    try {
      const notifCutoff = new Date(now);
      notifCutoff.setDate(notifCutoff.getDate() - settings.notifications_retention_days);

      const { data: notifications, error: notifError } = await supabase
        .from("notifications")
        .select("*")
        .lt("created_at", notifCutoff.toISOString())
        .eq("read", true);

      if (notifError) throw notifError;

      if (notifications && notifications.length > 0) {
        // Store snapshot
        await supabase
          .from("archive_snapshots")
          .insert({
            data: notifications,
            record_count: notifications.length,
            checksum: generateChecksum(JSON.stringify(notifications)),
          });

        // Delete
        const { error: deleteError } = await supabase
          .from("notifications")
          .delete()
          .lt("created_at", notifCutoff.toISOString())
          .eq("read", true);

        results.push({
          type: "notifications",
          records_archived: notifications.length,
          records_deleted: deleteError ? 0 : notifications.length,
          success: !deleteError,
          error: deleteError?.message,
        });

        console.log(`✅ Notifications archived: ${notifications.length}`);
      } else {
        results.push({
          type: "notifications",
          records_archived: 0,
          records_deleted: 0,
          success: true,
        });
      }
    } catch (error) {
      console.error("Notifications archive error:", error);
      results.push({
        type: "notifications",
        records_archived: 0,
        records_deleted: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // =======================================================================
    // Create Archive Log Entry
    // =======================================================================
    const totalArchived = results.reduce((sum, r) => sum + r.records_archived, 0);
    const totalDeleted = results.reduce((sum, r) => sum + r.records_deleted, 0);
    const allSuccess = results.every(r => r.success);

    const { data: logData, error: logError } = await supabase
      .from("archive_logs")
      .insert({
        archive_name: `auto_archive_${now.toISOString().split("T")[0]}`,
        archive_type: "full_backup",
        records_archived: totalArchived,
        storage_type: "supabase_storage",
        export_format: "json",
        triggered_by: "auto",
        status: allSuccess ? "completed" : "failed",
        source_data_deleted: totalDeleted > 0,
        deleted_at: totalDeleted > 0 ? now.toISOString() : null,
        error_message: allSuccess ? null : results.filter(r => r.error).map(r => `${r.type}: ${r.error}`).join("; "),
      })
      .select()
      .single();

    if (logError) {
      console.error("Error creating archive log:", logError);
    }

    // =======================================================================
    // Send Notification Email
    // =======================================================================
    if (settings.notify_on_archive && settings.notify_email && totalArchived > 0) {
      try {
        const emailBody = `
          <h2>🗄️ Automatische Archivierung abgeschlossen</h2>
          <p>Datum: ${now.toLocaleDateString("de-CH")}</p>
          <h3>Zusammenfassung:</h3>
          <ul>
            ${results.map(r => `
              <li>
                <strong>${r.type}:</strong> 
                ${r.records_archived} archiviert, 
                ${r.records_deleted} gelöscht
                ${r.error ? `<span style="color:red">(Fehler: ${r.error})</span>` : "✓"}
              </li>
            `).join("")}
          </ul>
          <p><strong>Total:</strong> ${totalArchived} Datensätze archiviert, ${totalDeleted} gelöscht</p>
          <hr>
          <p><small>Diese E-Mail wurde automatisch automatisch gesendet.</small></p>
        `;

        // Notification email is not implemented yet — log only for now.
        console.log(`📧 Would send notification to: ${settings.notify_email}`);
      } catch (emailError) {
        console.error("Error sending notification:", emailError);
      }
    }

    // =======================================================================
    // Return Response
    // =======================================================================
    const response = {
      success: allSuccess,
      timestamp: now.toISOString(),
      archive_log_id: logData?.id,
      summary: {
        total_archived: totalArchived,
        total_deleted: totalDeleted,
      },
      details: results,
    };

    console.log("🎉 Auto-archive completed:", JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Auto-archive failed:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to generate checksum
function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

