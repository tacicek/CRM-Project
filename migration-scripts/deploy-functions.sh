#!/bin/bash

# ===========================================
# Supabase Edge Functions Deploy Script
# ===========================================

echo "🚀 Starting Edge Functions deployment..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function list
FUNCTIONS=(
    "match-lead"
    "accept-lead"
    "calculate-lead-price"
    "calculate-distance"
    "send-lead-confirmation"
    "notify-companies"
    "send-offer"
    "notify-offer-response"
    "notify-besichtigung"
    "confirm-besichtigung"
    "handle-proposal-response"
    "handle-reschedule-response"
    "notify-appointment-reschedule"
    "notify-appointment-reminder"
    "notify-appointment-cancelled"
    "create-token-checkout"
    "stripe-webhook"
    "send-purchase-confirmation"
    "send-token-notification"
    "admin-create-user"
    "admin-delete-user"
    "admin-reset-password"
    "admin-update-user-email"
    "notify-admin-new-lead"
    "google-places-autocomplete"
    "google-places-details"
    "resend-email"
    "import-swiss-plz"
)

# Go to project root
cd "$(dirname "$0")/.."

echo "📦 Total functions to deploy: ${#FUNCTIONS[@]}"
echo ""

# Deploy each function
SUCCESS=0
FAILED=0

for func in "${FUNCTIONS[@]}"; do
    echo -n "  📤 Deploying: $func ... "
    
    if npx supabase functions deploy "$func" --no-verify-jwt 2>/dev/null; then
        echo -e "${GREEN}✅ OK${NC}"
        ((SUCCESS++))
    else
        echo -e "${RED}❌ FAILED${NC}"
        ((FAILED++))
    fi
done

echo ""
echo "========================================="
echo -e "✅ Successful: ${GREEN}$SUCCESS${NC}"
echo -e "❌ Failed: ${RED}$FAILED${NC}"
echo "========================================="

if [ $FAILED -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Some functions failed to deploy. Check logs:${NC}"
    echo "   supabase functions logs <function-name>"
fi

echo ""
echo "🎉 Deployment completed!"

