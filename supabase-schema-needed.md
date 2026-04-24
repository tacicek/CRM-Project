# Supabase Schema Required — Standalone CRM

This file documents every Supabase table, storage bucket, and Edge Function still
actively used in the standalone CRM codebase (after portal/marketplace removal).
Use this to set up a fresh Supabase project from scratch.

---

## 1. Tables

### `companies`
Core single-tenant company record. One row per deployment.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `user_id` | uuid — FK to `auth.users` |
| `company_name` | text |
| `logo_url` | text nullable |
| `is_verified` | boolean nullable |
| `manual_import_enabled` | boolean default false |
| `email` | text |
| `phone` | text nullable |
| `address` | text nullable |
| `website` | text nullable |
| `vat_number` | text nullable |
| `iban` | text nullable |
| `bank_name` | text nullable |
| `twilio_account_sid` | text nullable |
| `twilio_auth_token` | text nullable |
| `twilio_phone_number` | text nullable |
| `resend_api_key` | text nullable |
| `from_email` | text nullable |
| `from_name` | text nullable |
| `signature_url` | text nullable |
| `offer_footer_text` | text nullable |
| `offer_validity_days` | int default 30 |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

**RLS**: Users can only see/update their own company (`user_id = auth.uid()`).

---

### `leads`
Customer inquiries / leads. Created via manual import or received from external system.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `slug` | text unique |
| `service_type` | text (e.g. "umzug", "reinigung") |
| `from_plz` | text |
| `from_city` | text |
| `from_street` | text nullable |
| `from_house_number` | text nullable |
| `from_floor` | int nullable |
| `from_has_lift` | bool nullable |
| `from_rooms` | numeric nullable |
| `from_living_space_m2` | numeric nullable |
| `to_plz` | text nullable |
| `to_city` | text nullable |
| `to_street` | text nullable |
| `to_house_number` | text nullable |
| `to_floor` | int nullable |
| `to_has_lift` | bool nullable |
| `preferred_date` | date nullable |
| `preferred_time_slot` | text nullable |
| `description` | text nullable |
| `customer_first_name` | text |
| `customer_last_name` | text |
| `customer_email` | text |
| `customer_phone` | text |
| `distance_km` | numeric nullable |
| `estimated_duration_minutes` | int nullable |
| `estimated_job_price_min` | numeric nullable |
| `estimated_job_price_max` | numeric nullable |
| `estimated_job_price_confidence` | text nullable |
| `packing_service_needed` | bool nullable |
| `cleaning_service_needed` | bool nullable |
| `storage_needed` | bool nullable |
| `storage_duration` | text nullable |
| `storage_volume` | text nullable |
| `special_items` | text[] nullable |
| `has_heavy_items` | bool nullable |
| `piano_type` | text nullable |
| `piano_weight_kg` | numeric nullable |
| `additional_info` | text nullable |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

**RLS**: Company users can read leads linked to their `lead_distributions`.

---

### `lead_distributions`
Maps leads to companies (in standalone CRM: one distribution per lead for this company).

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `lead_id` | uuid FK → `leads` |
| `company_id` | uuid FK → `companies` |
| `status` | text: "sent" \| "accepted" \| "rejected" \| "expired" |
| `sent_at` | timestamptz |
| `expires_at` | timestamptz nullable |
| `token_cost` | int nullable (unused in standalone CRM, keep for data compat) |
| `created_at` | timestamptz |

**RLS**: Company can only see its own distributions (`company_id = <company_id>`).

---

### `offers`
Quotes/offers created for leads.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `lead_id` | uuid FK → `leads` nullable |
| `status` | text: "draft" \| "sent" \| "viewed" \| "accepted" \| "rejected" \| "expired" |
| `title` | text |
| `valid_until` | date nullable |
| `notes` | text nullable |
| `total_price` | numeric |
| `customer_name` | text |
| `customer_email` | text |
| `customer_phone` | text nullable |
| `customer_address` | text nullable |
| `sent_at` | timestamptz nullable |
| `viewed_at` | timestamptz nullable |
| `responded_at` | timestamptz nullable |
| `customer_response` | text nullable |
| `customer_response_note` | text nullable |
| `share_token` | uuid unique (used for `/offerte/:token` public link) |
| `include_agb` | bool default false |
| `include_checklist` | bool default false |
| `time_range_enabled` | bool default false |
| `time_range_price_min` | numeric nullable |
| `time_range_price_max` | numeric nullable |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

**RLS**: Company can CRUD its own offers. Public read via `share_token`.

---

### `offer_items`
Line items for an offer.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `offer_id` | uuid FK → `offers` |
| `position` | int |
| `description` | text |
| `quantity` | numeric |
| `unit` | text nullable |
| `unit_price` | numeric |
| `total_price` | numeric |
| `created_at` | timestamptz |

**RLS**: Inherit from offer (company_id join).

---

### `offer_leistungsuebersicht`
Optional service summary block attached to offers.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `offer_id` | uuid FK → `offers` |
| `content` | jsonb |
| `created_at` | timestamptz |

---

### `appointments`
Calendar events: besichtigung, service, follow_up, meeting, blocked.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `lead_id` | uuid FK → `leads` nullable |
| `offer_id` | uuid FK → `offers` nullable |
| `title` | text |
| `appointment_type` | text |
| `appointment_date` | timestamptz |
| `appointment_end` | timestamptz nullable |
| `status` | text: "scheduled" \| "confirmed" \| "cancelled" \| "completed" \| "rescheduled" |
| `notes` | text nullable |
| `customer_name` | text nullable |
| `customer_email` | text nullable |
| `customer_phone` | text nullable |
| `address` | text nullable |
| `team_member_ids` | uuid[] nullable |
| `resource_ids` | uuid[] nullable |
| `cancellation_token` | uuid unique nullable |
| `reschedule_token` | uuid unique nullable |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

**RLS**: Company can CRUD its own appointments. Public read/write on cancel/reschedule tokens.

---

### `appointment_history`
Audit log for appointment status changes.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `appointment_id` | uuid FK → `appointments` |
| `old_status` | text |
| `new_status` | text |
| `changed_by` | text nullable |
| `changed_at` | timestamptz |

---

### `auftraege`
Jobs/orders linked to offers.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `offer_id` | uuid FK → `offers` nullable |
| `lead_id` | uuid FK → `leads` nullable |
| `title` | text |
| `status` | text |
| `scheduled_date` | date nullable |
| `crew_size` | int nullable |
| `vehicle_info` | text nullable |
| `notes` | text nullable |
| `customer_name` | text nullable |
| `customer_phone` | text nullable |
| `from_address` | text nullable |
| `to_address` | text nullable |
| `team_member_ids` | uuid[] nullable |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

---

### `team_members`
Staff / employees of the company.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `name` | text |
| `role` | text nullable |
| `phone` | text nullable |
| `email` | text nullable |
| `color` | text nullable (calendar color) |
| `created_at` | timestamptz |

---

### `team_availability`
Recurring availability blocks per team member.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `team_member_id` | uuid FK → `team_members` |
| `company_id` | uuid FK → `companies` |
| `day_of_week` | int (0=Sun … 6=Sat) |
| `start_time` | time |
| `end_time` | time |

---

### `firma_resources`
Vehicles, equipment, etc.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `name` | text |
| `type` | text nullable |
| `license_plate` | text nullable |

---

### `checklist_templates`
Checklist items for moving/service jobs.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `title` | text |
| `items` | jsonb |
| `service_type` | text nullable |
| `is_default` | bool default false |
| `position` | int default 0 |
| `created_at` | timestamptz |

---

### `company_service_items`
Service catalog items (line items offered by this company).

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `name` | text |
| `description` | text nullable |
| `unit` | text nullable |
| `unit_price` | numeric nullable |
| `category` | text nullable |
| `position` | int default 0 |
| `is_active` | bool default true |
| `created_at` | timestamptz |

---

### `leistungsuebersicht_templates`
Templates for the service overview PDF section.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `name` | text |
| `content` | jsonb |
| `is_default` | bool default false |
| `created_at` | timestamptz |

---

### `agb_sections`
Custom AGB (Terms & Conditions) sections for PDF offers.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `title` | text |
| `content` | text |
| `position` | int default 0 |
| `is_active` | bool default true |
| `created_at` | timestamptz |

---

### `company_offer_templates`
Saved offer templates.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `name` | text |
| `items` | jsonb |
| `created_at` | timestamptz |

---

### `company_plz_coverage`
Swiss postal codes this company covers (used for lead matching if applicable).

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `plz` | text |
| `city` | text nullable |
| `created_at` | timestamptz |

---

### `company_services`
Which service types this company provides.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `service_type` | text |

---

### `service_catalog`
Global service type definitions (read-only reference data).

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `type` | text unique |
| `label` | text |
| `description` | text nullable |

---

### `swiss_plz`
Reference table of Swiss postal codes (read-only).

| Column | Notes |
|---|---|
| `plz` | text PK |
| `city` | text |
| `canton` | text |

---

### `quittungen`
Receipts / invoices.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `offer_id` | uuid FK → `offers` nullable |
| `quittung_nr` | text unique |
| `status` | text: "draft" \| "sent" |
| `customer_name` | text |
| `customer_email` | text nullable |
| `customer_address` | text nullable |
| `items` | jsonb |
| `total_amount` | numeric |
| `payment_method` | text nullable |
| `issued_date` | date |
| `notes` | text nullable |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

---

### `umzugsbox_rentals`
Moving box rental orders.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `lead_id` | uuid nullable |
| `customer_name` | text |
| `customer_phone` | text nullable |
| `customer_email` | text nullable |
| `delivery_address` | text |
| `pickup_date` | date |
| `return_date` | date nullable |
| `box_count` | int |
| `status` | text |
| `notes` | text nullable |
| `created_at` | timestamptz |

---

### `notifications`
In-app notifications per company.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `title` | text |
| `body` | text nullable |
| `type` | text |
| `metadata` | jsonb nullable |
| `read` | bool default false |
| `created_at` | timestamptz |

**RLS**: Company can only see its own notifications.

---

### `support_tickets`
Support requests from company users.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `subject` | text |
| `status` | text: "open" \| "in_progress" \| "resolved" \| "closed" |
| `created_at` | timestamptz |

---

### `support_ticket_messages`
Messages within a support ticket.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `ticket_id` | uuid FK → `support_tickets` |
| `sender` | text: "company" \| "support" |
| `message` | text |
| `created_at` | timestamptz |

---

### `virtual_besichtigung_sessions`
Virtual inspection sessions (photo/video uploads from customers).

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `lead_id` | uuid FK → `leads` nullable |
| `token` | uuid unique (public upload link) |
| `status` | text: "pending" \| "uploaded" \| "analysed" |
| `customer_name` | text |
| `customer_email` | text nullable |
| `created_at` | timestamptz |

---

### `company_reminder_settings`
Email/SMS reminder configuration per company.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `reminder_type` | text |
| `enabled` | bool |
| `hours_before` | int |

---

### `pending_team_reminders`
Scheduled reminders for team members.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `appointment_id` | uuid nullable |
| `send_at` | timestamptz |
| `status` | text |

---

### `email_logs`
Log of sent emails for tracking.

| Column | Notes |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK → `companies` |
| `recipient_email` | text |
| `subject` | text |
| `template` | text nullable |
| `status` | text |
| `sent_at` | timestamptz |
| `offer_id` | uuid nullable |

---

## 2. Storage Buckets

| Bucket | Access | Purpose |
|---|---|---|
| `company-logos` | Authenticated write, public read | Company logos and signature images |
| `besichtigung-uploads` | Public write (via token), company read | Customer photo/video uploads for virtual inspections |

---

## 3. Edge Functions Still Called

| Function | Trigger | Purpose |
|---|---|---|
| `accept-lead` | Company accepts a distribution | Marks distribution as accepted, sends notifications |
| `send-offer` | Offer sent to customer | Generates PDF, sends email via Resend |
| `send-quittung` | Receipt sent to customer | Generates PDF, sends email via Resend |
| `confirm-besichtigung` | Besichtigung appointment confirmed/declined | Sends confirmation email to customer |
| `extract-anfrage-ai` | Manual import form | AI extraction of lead details from raw text |
| `import-manual-lead` | Manual import form submit | Creates lead + distribution for this company |
| `notify-support-ticket` | Support dialog | Notifies admin of new ticket (optional) |

### Functions referenced but NOT needed in standalone CRM (can be removed):
- `create-token-checkout` — Stripe token purchase (portal only)
- `send-token-notification` — Token balance alerts (portal only)
- `create-crm-subscription` — CRM subscription upsell (portal only)

---

## 4. RLS Policy Patterns Needed

```sql
-- companies: owner only
CREATE POLICY "company_owner_all" ON companies
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- leads: company can read leads for their distributions
CREATE POLICY "leads_via_distribution" ON leads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lead_distributions ld
      WHERE ld.lead_id = leads.id
        AND ld.company_id IN (
          SELECT id FROM companies WHERE user_id = auth.uid()
        )
    )
  );

-- lead_distributions: company reads own
CREATE POLICY "ld_company_read" ON lead_distributions
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())
  );

-- offers: company CRUD own
CREATE POLICY "offers_company_crud" ON offers
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- offers: public read via share_token (for /offerte/:token)
CREATE POLICY "offers_public_token" ON offers
  FOR SELECT USING (share_token IS NOT NULL);

-- appointments: company CRUD own
CREATE POLICY "appointments_company" ON appointments
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- appointments: public update via cancel/reschedule tokens
CREATE POLICY "appointments_public_token" ON appointments
  FOR UPDATE USING (
    cancellation_token IS NOT NULL OR reschedule_token IS NOT NULL
  );

-- notifications: company reads/deletes own
CREATE POLICY "notifications_company" ON notifications
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- swiss_plz: public read
CREATE POLICY "swiss_plz_public_read" ON swiss_plz FOR SELECT USING (true);

-- service_catalog: public read
CREATE POLICY "service_catalog_public_read" ON service_catalog FOR SELECT USING (true);
```

All other tables (team_members, appointments, offers, lead_distributions, etc.) follow the same pattern:
- `company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())`

---

## 5. Auth Setup

- **Email/Password** authentication enabled
- `user_roles` table is referenced in `useAuth.tsx` to set `isAdmin`. In standalone CRM, this table can be minimal (no rows needed unless admin panel is added later):

```sql
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users,
  role text -- 'super_admin' | 'admin' | 'moderator'
);
```

- **Password reset**: email template must include redirect to `{VITE_APP_URL}/auth/reset-password`
