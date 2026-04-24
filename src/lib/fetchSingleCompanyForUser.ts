import { supabase } from "@/integrations/supabase/client";

/**
 * Returns exactly one company for a logged-in user.
 *
 * Why: the app assumes "one company per user", but the database can contain
 * multiple companies with the same user_id (e.g. demo/seed data). Using
 * `.maybeSingle()` would error in that case.
 */
export async function fetchSingleCompanyForUser<T>(params: {
  userId: string;
  userEmail?: string | null;
  select: string;
}): Promise<T | null> {
  const makeBase = () =>
    supabase.from("companies").select(params.select).eq("user_id", params.userId);

  // Prefer the company whose email (or notification email) matches the user's login email.
  if (params.userEmail) {
    const { data: byEmail, error: byEmailError } = await makeBase()
      .eq("email", params.userEmail)
      .limit(1);

    if (byEmailError) throw byEmailError;
    if (byEmail?.length) return byEmail[0] as T;

    const { data: byNotificationEmail, error: byNotificationEmailError } = await makeBase()
      .eq("notification_email", params.userEmail)
      .limit(1);

    if (byNotificationEmailError) throw byNotificationEmailError;
    if (byNotificationEmail?.length) return byNotificationEmail[0] as T;
  }

  // Fallback: most recently created company for that user.
  const { data: latest, error: latestError } = await makeBase()
    .order("created_at", { ascending: false })
    .limit(1);

  if (latestError) throw latestError;
  return (latest?.[0] as T) ?? null;
}
