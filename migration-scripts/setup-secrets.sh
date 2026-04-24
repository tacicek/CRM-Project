#!/bin/bash

# ===========================================
# Supabase Secrets Setup Script
# ===========================================

echo "🔐 Supabase Secrets Setup"
echo ""
echo "This script helps you configure required Edge Function secrets."
echo ""

# Go to project root
cd "$(dirname "$0")/.."

# Resend API Key
echo "📧 RESEND API KEY"
echo "   Get your API key from: https://resend.com/api-keys"
read -p "   RESEND_API_KEY: " RESEND_API_KEY
if [ -n "$RESEND_API_KEY" ]; then
    npx supabase secrets set RESEND_API_KEY="$RESEND_API_KEY"
    echo "   ✅ RESEND_API_KEY set"
fi
echo ""

# Stripe Secret Key
echo "💳 STRIPE SECRET KEY"
echo "   Stripe Dashboard: https://dashboard.stripe.com/apikeys"
read -p "   STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
if [ -n "$STRIPE_SECRET_KEY" ]; then
    npx supabase secrets set STRIPE_SECRET_KEY="$STRIPE_SECRET_KEY"
    echo "   ✅ STRIPE_SECRET_KEY set"
fi
echo ""

# Stripe Webhook Secret
echo "🔗 STRIPE WEBHOOK SECRET"
echo "   Stripe Dashboard > Webhooks > Signing secret"
read -p "   STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK_SECRET
if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
    npx supabase secrets set STRIPE_WEBHOOK_SECRET="$STRIPE_WEBHOOK_SECRET"
    echo "   ✅ STRIPE_WEBHOOK_SECRET set"
fi
echo ""

# Google Places API Key
echo "🗺️  GOOGLE PLACES API KEY"
echo "   Google Cloud Console: https://console.cloud.google.com/apis/credentials"
read -p "   GOOGLE_PLACES_API_KEY: " GOOGLE_PLACES_API_KEY
if [ -n "$GOOGLE_PLACES_API_KEY" ]; then
    npx supabase secrets set GOOGLE_PLACES_API_KEY="$GOOGLE_PLACES_API_KEY"
    echo "   ✅ GOOGLE_PLACES_API_KEY set"
fi
echo ""

# Site URL
echo "🌐 SITE URL"
read -p "   SITE_URL (e.g. https://offerio.ch): " SITE_URL
if [ -n "$SITE_URL" ]; then
    npx supabase secrets set SITE_URL="$SITE_URL"
    echo "   ✅ SITE_URL set"
fi
echo ""

echo "========================================="
echo "🎉 Secret setup completed!"
echo ""
echo "To view configured secrets:"
echo "   npx supabase secrets list"
echo "========================================="

