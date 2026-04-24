# Product Requirements Document (PRD)
## Offerio - Lead Management Platform

**Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Production

---

## 1. Executive Summary

### 1.1 Product Overview
Offerio is a B2B2C lead management platform that connects Swiss service providers (companies) with customers seeking services such as moving, cleaning, disposal, storage, and other home services. The platform automates lead distribution, pricing, and communication between parties.

### 1.2 Business Goals
- **Primary Goal:** Create an efficient marketplace for Swiss service providers to acquire qualified leads
- **Revenue Model:** Token-based system where companies purchase leads
- **Market:** Switzerland (German-speaking regions)
- **Target Users:** 
  - Service companies (Umzug, Reinigung, Entsorgung, etc.)
  - End customers seeking services
  - Platform administrators

### 1.3 Success Metrics
- Lead conversion rate (leads → accepted offers)
- Company retention rate
- Average tokens spent per company per month
- Customer satisfaction (form completion rate)
- Lead verification time

---

## 2. User Personas

### 2.1 End Customer (Lead Submitter)
**Profile:**
- Age: 25-65
- Location: Switzerland
- Need: Find reliable service providers for home services
- Tech-savviness: Medium to High

**Goals:**
- Quickly submit service requests
- Receive multiple competitive offers
- Compare prices and services
- Book services easily

**Pain Points:**
- Time-consuming to contact multiple companies
- Difficulty comparing offers
- Uncertainty about service quality

### 2.2 Company User (Service Provider)
**Profile:**
- Small to medium-sized service companies
- 1-50 employees
- Active in specific Swiss regions (PLZ-based)
- Need consistent lead flow

**Goals:**
- Receive qualified leads in their service area
- Manage leads efficiently
- Create and send professional offers
- Track lead conversion and ROI

**Pain Points:**
- Expensive marketing costs
- Unqualified leads
- Manual lead management
- Time-consuming offer creation

### 2.3 Admin User
**Profile:**
- Platform operators
- Support staff
- Moderators

**Goals:**
- Monitor platform health
- Verify and manage leads
- Manage companies and users
- Configure pricing and settings
- Ensure quality control

---

## 3. User Roles & Permissions

### 3.1 Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| **Super Admin** | 100 | Full system access including user management |
| **Admin** | 50 | Full access except user management |
| **Moderator** | 10 | Limited access (leads, verification, blog) |
| **Company User** | 0 | Company dashboard access only |

### 3.2 Permission Matrix

| Feature | Super Admin | Admin | Moderator | Company |
|---------|-------------|-------|-----------|---------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Lead Management | ✅ | ✅ | ✅ | ✅ (own) |
| Lead Verification | ✅ | ✅ | ✅ | ❌ |
| Company Management | ✅ | ✅ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| Token Packages | ✅ | ✅ | ❌ | ✅ (view) |
| Pricing Settings | ✅ | ✅ | ❌ | ❌ |
| Blog Management | ✅ | ✅ | ✅ | ❌ |
| Email Logs | ✅ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ✅ (own) |
| Settings | ✅ | ✅ | ✅ | ✅ (own) |

---

## 4. Core Features

### 4.1 Lead Submission System

#### 4.1.1 Supported Service Types
1. **Umzug (Moving)**
   - Privatumzug (Private moving)
   - Firmenumzug (Business moving)
   - Bueroumzug (Office moving)
   - Internationaler Umzug (International moving)

2. **Reinigung (Cleaning)**
   - Endreinigung (Final cleaning)
   - Grundreinigung (Deep cleaning)
   - Fensterreinigung (Window cleaning)
   - Unterhaltsreinigung (Maintenance cleaning)
   - Bueroreinigung (Office cleaning)

3. **Räumung (Clearing)**
   - Wohnungsräumung (Apartment clearing)
   - Hausräumung (House clearing)
   - Kellerräumung (Basement clearing)
   - Dachbodenräumung (Attic clearing)
   - Nachlassräumung (Estate clearing)

4. **Entsorgung (Disposal)**
   - Moebelentsorgung (Furniture disposal)
   - Elektroentsorgung (Electronics disposal)
   - Sperrgutentsorgung (Bulky waste disposal)

5. **Klaviertransport (Piano Transport)**
   - Klavier transport
   - Fluegel transport
   - Einlagerung (Storage)
   - Entsorgung (Disposal)

6. **Moebellift (Furniture Lift)**
   - Rental
   - Service

7. **Lagerung (Storage)**
   - Moebeleinlagerung (Furniture storage)
   - Umzugslager (Moving storage)
   - Self-Storage
   - Klimatisiert (Climate-controlled)

8. **Malerarbeit (Painting)**
   - Innenanstrich (Interior painting)
   - Aussenanstrich (Exterior painting)
   - Tapezieren (Wallpapering)
   - Lackieren (Varnishing)

9. **Renovation**
   - Komplettrenovierung (Complete renovation)
   - Badrenovierung (Bathroom renovation)
   - Kuechenrenovierung (Kitchen renovation)
   - Elektroinstallation
   - Sanitär

10. **Transport**
    - Moebeltransport (Furniture transport)
    - USM Transport
    - Wasserbett Transport

#### 4.1.2 Form Wizard System
- **Multi-step forms** with progress indicators
- **Service-specific fields** based on selected service type
- **Address validation** using Google Places API
- **Data persistence** in localStorage (prevents data loss)
- **Responsive design** for mobile and desktop
- **reCAPTCHA v3** spam protection
- **Form validation** with Zod schemas

#### 4.1.3 Lead Data Structure
```typescript
{
  // Basic Info
  service_type: string;
  source: 'web_form' | 'ai_voice' | 'manual' | 'import' | 'widget' | 'api';
  status: 'new' | 'pending_verification' | 'verified' | 'distributed' | 'completed' | 'cancelled';
  
  // Addresses
  from_plz, from_city, from_street, from_house_number, from_floor, from_has_lift;
  to_plz, to_city, to_street, to_house_number, to_floor, to_has_lift;
  
  // Customer Info
  customer_first_name, customer_last_name, customer_email, customer_phone;
  customer_salutation, customer_contact_time;
  
  // Service Details (varies by service type)
  // Umzug: rooms, living_space_m2, packing_service_needed, etc.
  // Reinigung: property_type, bathroom_count, cleaning_type, etc.
  // Klaviertransport: piano_type, piano_weight_kg, staircase_type, etc.
  
  // Pricing
  token_cost: number;
  max_companies: 1 | 3 | 5; // Exklusiv | Premium | Standard
  estimated_job_price_min, estimated_job_price_max;
  
  // Metadata
  form_version: number;
  detailed_form_data: JSONB; // Complete form data
  ip_address: string;
  source_form_id: UUID;
}
```

### 4.2 Lead Distribution System

#### 4.2.1 Matching Algorithm
**Location-Based Matching:**
- Primary: Exact PLZ match (distance = 0 km)
- Secondary: Radius-based matching (configurable per company)
- Uses `find_companies_in_radius` database function

**Service Type Matching:**
- Normalizes service variants to base types
- Example: `reinigung_end` → `reinigung`
- Matches against `company_services` table

**Company Preferences:**
- `lead_sharing_preference`: `only_1` | `only_3` | `only_5` | `both`
- Filters leads based on `max_companies` value

#### 4.2.2 Distribution Flow
```
1. Lead submitted → status: 'pending_verification'
2. Admin verifies → status: 'verified'
3. match-lead function called
4. Calculate dynamic token price
5. Find matching companies (PLZ + service type)
6. Filter by company preferences
7. Create lead_distributions (status: 'sent')
8. Send email notifications
9. Create in-app notifications
10. Update lead status: 'distributed'
```

#### 4.2.3 Dynamic Pricing
**Formula:** `CPC × exclusivity_mult × size_mult × urgency_mult`

**Factors:**
- **Base CPC:** Set per service type in `service_acquisition_costs`
- **Exclusivity Multiplier:**
  - max_companies = 1: 2.5x (Exklusiv)
  - max_companies ≤ 3: 1.5x (Premium)
  - max_companies ≥ 5: 1.0x (Standard)
- **Size Multiplier:** Based on rooms or m²
  - 6+ rooms or 150+ m²: 1.6x
  - 5 rooms or 100-149 m²: 1.4x
  - 4 rooms or 70-99 m²: 1.25x
  - 3 rooms or <70 m²: 1.1x
  - 1-2 rooms: 1.0x
- **Urgency Multiplier:**
  - ≤3 days: 1.2x
  - ≤7 days: 1.1x
  - >7 days: 1.0x

**Price Limits:**
- Minimum: 15 tokens
- Maximum: 250 tokens

### 4.3 Token System

#### 4.3.1 Token Packages
Pre-defined packages with Stripe integration:
- Small: 50 tokens
- Medium: 100 tokens
- Large: 250 tokens
- Enterprise: Custom amounts

#### 4.3.2 Token Usage
- **Lead Acceptance:** Deducted when company accepts a lead
- **Transaction History:** All transactions logged in `token_transactions`
- **Balance Tracking:** Real-time balance in `companies.token_balance`

#### 4.3.3 Token Flow
```
1. Company purchases token package → Stripe checkout
2. Payment successful → Token balance increased
3. Lead distributed → Company sees lead
4. Company accepts → Tokens deducted
5. Transaction recorded → History updated
```

### 4.4 Lead Acceptance System

#### 4.4.1 Acceptance Flow
```
1. Company views lead → Lead distribution (status: 'sent')
2. Company clicks "Accept" → accept-lead function called
3. Verify company has sufficient tokens
4. Atomic check: Is quota full? (accepted_count < max_companies)
5. If quota full → Update distribution (status: 'quota_full')
6. If available → Accept lead:
   - Increment lead.accepted_count
   - Update distribution (status: 'accepted')
   - Deduct tokens from company balance
   - Record transaction
   - If quota now full → Notify remaining companies
```

#### 4.4.2 Quota Management
- **First-come-first-served:** All eligible companies see lead
- **Atomic Operations:** Prevents race conditions
- **Quota Full Notification:** Companies receive email when quota reached

### 4.5 Offer Management System

#### 4.5.1 Offer Creation
- Company creates offer from accepted lead
- Multi-step form with:
  - Service details
  - Pricing (items with quantities and prices)
  - Terms and conditions
  - Validity period

#### 4.5.2 Offer PDF Generation
- Professional PDF with company branding
- Includes:
  - Company logo and contact info
  - Customer details
  - Service description
  - Itemized pricing
  - Terms and conditions
  - Signature section

#### 4.5.3 Offer Response
- Customer views offer via public link
- Can accept, reject, or request changes
- Email notifications sent to company

### 4.6 Auftrag (Order) Management

#### 4.6.1 Auftrag Creation
- Created from accepted offer
- Tracks order status and completion
- PDF generation for orders

#### 4.6.2 Umzugsboxen (Box Rental)
- Special service type for box rentals
- Tracks delivery and pickup addresses
- PDF generation for rental agreements

### 4.7 Appointment System

#### 4.7.1 Appointment Types
- **Besichtigung:** Site visit/assessment
- **Service:** Service delivery
- **Follow-up:** Follow-up meeting
- **Meeting:** General meeting
- **Blocked:** Unavailable time slot

#### 4.7.2 Appointment Features
- Calendar integration
- Team member assignment
- Customer confirmation via email
- Rescheduling and cancellation

### 4.8 PDF Generation

#### 4.8.1 Supported PDFs
1. **Offerte (Quote)**
   - Company branding
   - Service details
   - Itemized pricing
   - Terms and conditions

2. **Auftrag (Order)**
   - Order confirmation
   - Service details
   - Pricing breakdown
   - Signature section

3. **Umzugsboxen (Box Rental)**
   - Rental agreement
   - Delivery and pickup addresses
   - Box inventory
   - Pricing

4. **Checklist**
   - Service checklist
   - Pre-service items
   - Post-service items

#### 4.8.2 PDF Features
- Company logo embedding
- Custom colors (company primary color)
- Multi-page support
- Page break handling
- Professional typography

### 4.9 Email System

#### 4.9.1 Email Types
- **Lead Notifications:** New lead alerts to companies
- **Offer Emails:** Quote sent to customers
- **Appointment Confirmations:** Booking confirmations
- **Quota Full Notifications:** Lead quota reached alerts
- **Token Purchase Confirmations:** Payment receipts
- **Admin Notifications:** System alerts

#### 4.9.2 Email Features
- HTML templates with branding
- Responsive design
- Email logging in `email_logs` table
- Resend capability
- Error tracking

### 4.10 Security Features

#### 4.10.1 reCAPTCHA v3
- Invisible verification on form submission
- Score-based bot detection (minimum score: 0.5)
- Backend verification via edge function
- Fail-open design (works without keys)

#### 4.10.2 Row Level Security (RLS)
- Database-level access control
- Company users see only their data
- Admin users have elevated permissions
- Secure function execution (SECURITY DEFINER)

#### 4.10.3 Authentication
- Supabase Auth integration
- Role-based access control
- Session management
- Password reset functionality

---

## 5. Technical Architecture

### 5.1 Frontend Stack
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui + Tailwind CSS
- **State Management:** React hooks + Context
- **Form Validation:** Zod
- **PDF Generation:** jsPDF
- **Routing:** React Router

### 5.2 Backend Stack
- **Database:** PostgreSQL (Supabase)
- **Backend Functions:** Supabase Edge Functions (Deno)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Real-time:** Supabase Realtime subscriptions

### 5.3 Third-Party Integrations
- **Email:** Resend API
- **Payments:** Stripe
- **Maps:** Google Places API
- **Security:** Google reCAPTCHA v3
- **AI:** OpenAI (for lead extraction)

### 5.4 Database Schema

#### 5.4.1 Core Tables
- `leads` - Lead submissions
- `lead_distributions` - Lead-to-company mappings
- `companies` - Service provider companies
- `offers` - Quotes/offers created by companies
- `auftraege` - Orders/contracts
- `umzugsbox_rentals` - Box rental orders
- `appointments` - Scheduled appointments
- `token_transactions` - Token purchase and usage history
- `notifications` - In-app notifications
- `email_logs` - Email delivery logs

#### 5.4.2 User Management Tables
- `profiles` - User profile data
- `user_roles` - Role assignments
- `team_members` - Company team members

#### 5.4.3 Configuration Tables
- `service_acquisition_costs` - CPC and pricing multipliers
- `pricing_settings` - Token pricing configuration
- `token_packages` - Available token packages
- `lead_forms` - Custom form configurations

### 5.5 Edge Functions

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `match-lead` | Distribute leads to companies | No (internal) |
| `accept-lead` | Company accepts a lead | Yes (company) |
| `verify-recaptcha` | Verify reCAPTCHA tokens | No |
| `send-offer` | Send offer email to customer | Yes (company) |
| `notify-companies` | Notify companies of new leads | No (internal) |
| `admin-create-user` | Create admin/company users | Yes (admin) |
| `estimate-job-price` | Estimate job value | No (internal) |

---

## 6. User Flows

### 6.1 Customer Lead Submission Flow
```
1. Customer visits offerio.ch
2. Selects service type
3. Fills multi-step form
4. reCAPTCHA verification
5. Form submitted → Lead created (status: 'pending_verification')
6. Success page shown
7. Admin verifies lead
8. Lead distributed to companies
9. Companies receive notifications
```

### 6.2 Company Lead Acceptance Flow
```
1. Company logs in → Dashboard
2. Sees new lead notification
3. Views lead details
4. Checks token balance
5. Clicks "Accept Lead"
6. Tokens deducted
7. Lead moved to "Accepted Leads"
8. Company creates offer
9. Offer sent to customer
10. Customer responds
11. If accepted → Auftrag created
```

### 6.3 Admin Verification Flow
```
1. Admin logs in → Admin Panel
2. Navigates to Lead Verification
3. Views pending leads
4. Reviews lead details
5. Verifies or rejects lead
6. If verified → Lead distributed automatically
7. If rejected → Lead marked as rejected
```

---

## 7. Non-Functional Requirements

### 7.1 Performance
- **Page Load Time:** < 2 seconds
- **Form Submission:** < 3 seconds
- **PDF Generation:** < 5 seconds
- **Email Delivery:** < 30 seconds

### 7.2 Scalability
- Support 1000+ companies
- Handle 10,000+ leads per month
- Process 100+ concurrent form submissions

### 7.3 Security
- HTTPS only
- SQL injection prevention (parameterized queries)
- XSS prevention (React auto-escaping)
- CSRF protection (Supabase Auth)
- Rate limiting on API endpoints

### 7.4 Reliability
- 99.9% uptime target
- Database backups (daily)
- Error logging and monitoring
- Graceful error handling

### 7.5 Usability
- Mobile-responsive design
- German language UI
- Intuitive navigation
- Clear error messages
- Loading states for async operations

---

## 8. Future Enhancements

### 8.1 Planned Features
- **AI Voice Lead Extraction:** Voice-to-lead conversion
- **Mobile App:** Native iOS/Android apps
- **Advanced Analytics:** Company performance dashboards
- **Review System:** Customer reviews and ratings
- **Multi-language Support:** French, Italian, English
- **API Access:** Public API for integrations
- **Webhook System:** Real-time event notifications

### 8.2 Potential Features
- **Chat System:** In-app messaging between parties
- **Document Management:** File uploads and storage
- **Payment Integration:** Direct payment processing
- **Loyalty Program:** Rewards for frequent companies
- **Referral System:** Customer referral bonuses

---

## 9. Success Criteria

### 9.1 Business Metrics
- **Lead Conversion Rate:** > 30% (leads → accepted offers)
- **Company Retention:** > 80% monthly retention
- **Average Revenue per Company:** > CHF 500/month
- **Customer Satisfaction:** > 4.5/5 rating

### 9.2 Technical Metrics
- **System Uptime:** > 99.9%
- **Error Rate:** < 0.1%
- **API Response Time:** < 500ms (p95)
- **Form Completion Rate:** > 70%

---

## 10. Glossary

- **Lead:** A customer service request submitted through the platform
- **Token:** Virtual currency used to purchase leads
- **Offerte:** Quote/offer created by a company for a lead
- **Auftrag:** Order/contract created from an accepted offer
- **PLZ:** Swiss postal code (4 digits)
- **Exklusiv:** Lead distributed to only 1 company (highest price)
- **Premium:** Lead distributed to up to 3 companies
- **Standard:** Lead distributed to up to 5 companies
- **Besichtigung:** Site visit/assessment appointment
- **Umzugsboxen:** Moving box rental service

---

## 11. Appendix

### 11.1 API Endpoints
See Supabase Edge Functions documentation for API details.

### 11.2 Database Schema
See `supabase/migrations/` for complete database schema.

### 11.3 Environment Variables
See `.env.example` for required environment variables.

### 11.4 Deployment Guide
See `README.md` for deployment instructions.

---

**Document Owner:** Product Team  
**Review Cycle:** Quarterly  
**Next Review:** April 2025
