#!/bin/bash

# ===========================================
# Supabase Data Export Script
# ===========================================

echo "📤 Data export script"
echo ""

# Source Supabase details (Lovable)
OLD_HOST="db.yrehijkkurxywwhrxriu.supabase.co"
OLD_USER="postgres"
OLD_DB="postgres"

# Tables (excluding auth.*)
TABLES=(
    "service_catalog"
    "companies"
    "company_services"
    "company_plz_coverage"
    "company_service_items"
    "company_offer_templates"
    "leads"
    "lead_distributions"
    "lead_forms"
    "offers"
    "offer_items"
    "offer_leistungsuebersicht"
    "token_transactions"
    "token_packages"
    "pricing_rules"
    "pricing_settings"
    "appointments"
    "appointment_history"
    "appointment_reminders"
    "team_members"
    "team_availability"
    "firma_resources"
    "checklist_templates"
    "leistungsuebersicht_templates"
    "agb_sections"
    "notifications"
    "email_logs"
    "swiss_plz"
    "profiles"
    "user_roles"
    "ip_blacklist"
)

# Go to project root
cd "$(dirname "$0")/.."

echo "⚠️  You will be asked for the Lovable Supabase database password."
echo ""

# Create export directory
mkdir -p exports
EXPORT_FILE="exports/data_export_$(date +%Y%m%d_%H%M%S).sql"

echo "📦 Exporting tables to: $EXPORT_FILE"
echo ""

# Export each table
for table in "${TABLES[@]}"; do
    echo -n "  📄 $table ... "
    pg_dump -h "$OLD_HOST" -U "$OLD_USER" -d "$OLD_DB" \
        --data-only \
        --table="public.$table" \
        --no-owner \
        --no-privileges \
        >> "$EXPORT_FILE" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅"
    else
        echo "⚠️ (empty or error)"
    fi
done

echo ""
echo "========================================="
echo "✅ Export completed: $EXPORT_FILE"
echo ""
echo "To import this file into the new Supabase project:"
echo "  psql -h db.NEW_PROJECT_REF.supabase.co -U postgres -d postgres < $EXPORT_FILE"
echo "========================================="

