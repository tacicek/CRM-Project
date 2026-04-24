import { supabase } from "@/integrations/supabase/client";

interface CustomerConfirmationParams {
  firstName: string;
  lastName: string;
  email: string;
  serviceType: string;
  fromCity: string;
  toCity?: string;
  maxCompanies: number;
}

/**
 * Sends a confirmation email to the customer immediately after form submission.
 * Called from each wizard after submit_lead_json succeeds.
 * Errors are silently ignored so they don't block the success flow.
 */
export async function sendCustomerConfirmation(params: CustomerConfirmationParams): Promise<void> {
  try {
    await supabase.functions.invoke("send-lead-confirmation", {
      body: {
        customerFirstName: params.firstName,
        customerLastName: params.lastName,
        customerEmail: params.email,
        serviceType: params.serviceType,
        fromCity: params.fromCity,
        toCity: params.toCity || undefined,
        maxCompanies: params.maxCompanies,
      },
    });
  } catch (err) {
    console.error("[sendCustomerConfirmation] Failed:", err);
  }
}
