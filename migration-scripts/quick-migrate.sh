#!/bin/bash

# ===========================================
# Quick Migration Script
# One script for quick migration
# ===========================================

echo "🚀 Offerio Supabase Migration"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Go to project root
cd "$(dirname "$0")/.."

# Step 1: Collect project details
echo -e "${BLUE}📋 Step 1: New Supabase Project Details${NC}"
echo ""
read -p "New Supabase project reference (e.g. abcdefgh): " PROJECT_REF
echo ""

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference cannot be empty!${NC}"
    exit 1
fi

# Step 2: Link Supabase project
echo -e "${BLUE}🔗 Step 2: Linking Supabase project...${NC}"
echo ""

# Login check
if ! npx supabase projects list &>/dev/null; then
    echo "Signing in to Supabase..."
    npx supabase login
fi

# Link project
echo "Linking project: $PROJECT_REF"
npx supabase link --project-ref "$PROJECT_REF"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to link project! Check your database password.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Project linked${NC}"
echo ""

# Step 3: Run migrations
echo -e "${BLUE}🗃️  Step 3: Running database migrations...${NC}"
echo ""

npx supabase db push

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Migrations failed!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Migrations completed${NC}"
echo ""

# Step 4: Deploy Edge Functions
echo -e "${BLUE}⚡ Step 4: Deploying Edge Functions...${NC}"
echo ""

npx supabase functions deploy

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Some functions may not have deployed successfully${NC}"
fi
echo -e "${GREEN}✅ Function deployment completed${NC}"
echo ""

# Step 5: Secrets reminder
echo -e "${BLUE}🔐 Step 5: Configure secrets${NC}"
echo ""
echo "You need to set the following secrets:"
echo ""
echo "  supabase secrets set RESEND_API_KEY=re_xxxxx"
echo "  supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx"
echo "  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx"
echo "  supabase secrets set GOOGLE_PLACES_API_KEY=AIzaxxxxx"
echo "  supabase secrets set SITE_URL=https://offerio.ch"
echo ""
read -p "Run the interactive secret setup script now? (y/n): " RUN_SECRETS

if [ "$RUN_SECRETS" = "y" ] || [ "$RUN_SECRETS" = "Y" ]; then
    bash migration-scripts/setup-secrets.sh
fi
echo ""

# Step 6: Update frontend .env
echo -e "${BLUE}🌐 Step 6: Frontend .env settings${NC}"
echo ""

# Build API URL and collect key
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"
echo "Supabase URL: $SUPABASE_URL"
echo ""
echo "Get the Supabase anon key from Dashboard > Settings > API"
read -p "Anon Key: " ANON_KEY

if [ -n "$ANON_KEY" ]; then
    # Create or update .env file
    cat > .env << EOF
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
EOF
    echo -e "${GREEN}✅ .env file created${NC}"
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}🎉 MIGRATION COMPLETED!${NC}"
echo "========================================="
echo ""
echo "Completed steps:"
echo "  ✅ Supabase project linked"
echo "  ✅ Database migrations executed"
echo "  ✅ Edge Functions deployed"
echo "  ✅ .env file created"
echo ""
echo "Items to verify:"
echo "  1. Dashboard > Authentication > URL Configuration"
echo "     - Set Site URL"
echo "     - Add redirect URLs"
echo ""
echo "  2. Update Stripe webhook URL:"
echo "     https://${PROJECT_REF}.supabase.co/functions/v1/stripe-webhook"
echo ""
echo "  3. Test the application:"
echo "     npm run dev"
echo ""
echo "========================================="

