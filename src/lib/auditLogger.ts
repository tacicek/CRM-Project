import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UntypedFrom = (table: string) => {
  insert: (values: Record<string, unknown>) => Promise<{ error: PostgrestError | null }>;
};

const fromTable = supabase.from as unknown as UntypedFrom;

interface AuditLogEntry {
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: Record<string, unknown>;
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await fromTable("admin_activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: entry.action,
      entity_type: entry.entity_type || null,
      entity_id: entry.entity_id || null,
      details: entry.details || {},
    });
  } catch (err) {
    console.error("[AuditLogger] Failed to log action:", err);
  }
}
