# Supabase Migration Guide

This guide explains how to migrate from the legacy Lovable Supabase project to your own Supabase project.

## Prerequisites
- Install Supabase CLI
- Create a new Supabase project in the dashboard
- Prepare Project URL, anon key, service_role key, and database password

## Step 1: Link the project
Run: supabase login
Run: supabase link --project-ref YOUR_PROJECT_REF

## Step 2: Run migrations
Run: supabase db push

## Step 3: Deploy Edge Functions
Run: supabase functions deploy

## Step 4: Configure secrets
Set the following secrets in Edge Functions:
- RESEND_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- GOOGLE_PLACES_API_KEY
- SITE_URL

## Step 5: Frontend .env
Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env

## Step 6: Auth URL settings
Set Site URL and redirect URLs in Authentication URL Configuration

## Step 7: Optional data migration
Export data from old project and import into new project with pg_dump/psql

## Step 8: Verify
- Auth works
- Data is visible
- Functions run
- Emails are sent
- Stripe flow works

## Troubleshooting
Check logs with: supabase functions logs <function-name>

## Useful links
- https://supabase.com/dashboard
- https://supabase.com/docs/guides/cli
- https://supabase.com/docs/guides/functions
