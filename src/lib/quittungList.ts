import { z } from "zod";

/** Lightweight list records deliberately exclude signature bitmaps and position JSON. */
export const quittungListSchema = z.object({
  id: z.string(), company_id: z.string(), quittung_nr: z.string(), customer_name: z.string(),
  datum: z.string(), status: z.enum(["draft", "issued", "signed", "sent", "paid"]),
  gesamttotal: z.number().finite(), payment_status: z.enum(["open", "partial", "paid"]),
  paid_amount: z.number().finite(), issued_at: z.string().nullable(), sent_at: z.string().nullable(),
  rechnung_id: z.string().nullable(), version: z.number().int().positive(),
});
export type QuittungListItem = z.infer<typeof quittungListSchema>;
export type QuittungListFilter = "all" | "draft" | "issued" | "signed" | "sent" | "open" | "partial" | "paid";

export const quittungPaymentAction = (q: Pick<QuittungListItem, "issued_at" | "rechnung_id" | "payment_status">): "invoice" | "record" | null => {
  if (!q.issued_at || q.payment_status === "paid") return null;
  return q.rechnung_id ? "invoice" : "record";
};

/** PostgREST quoted values: commas/parentheses remain search text, not filter operators. */
export const quittungSearchFilter = (search: string): string => {
  const escaped = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[%_]/g, "\\$&");
  return `quittung_nr.ilike."%${escaped}%",customer_name.ilike."%${escaped}%"`;
};
