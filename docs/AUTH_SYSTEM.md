# Authentication System Documentation

## Overview

This document describes the authentication and authorization system for Offerio.

## User Types

### 1. Admin Users (Super Admin / Moderator)
- **Created by:** Admin Panel → `/admin/users`
- **Edge Function:** `admin-create-user`
- **Required Tables:**
  - `auth.users` - Supabase auth
  - `profiles` - User profile data
  - `user_roles` - Role assignment (admin/moderator)
- **Redirect:** `/admin`

### 2. Company Users (Firma Owner)
- **Created by:** Self-registration → `/partner-registrierung`
- **Required Tables:**
  - `auth.users` - Supabase auth
  - `profiles` - User profile data
  - `companies` - Company with `user_id = auth.uid()`
- **Redirect:** `/firma`

### 3. Company Users (Created by Admin)
- **Created by:** Admin Panel → `/admin/companies` (Add Company Dialog)
- **Edge Function:** `admin-create-user` (with company creation)
- **Required Tables:**
  - `auth.users` - Supabase auth
  - `profiles` - User profile data
  - `companies` - Company with `user_id` or matching `email`
- **Redirect:** `/firma`

## Login Flow (Auth.tsx)

```
User logs in
    │
    ▼
Check user_roles table
    │
    ├── Has 'admin' or 'moderator' role? → Redirect to /admin
    │
    ▼
Check companies table
    │
    ├── Has company (by user_id OR email)? → Redirect to /firma
    │
    ▼
Show "Keine Firma verknuepft" error
```

## Database Functions

### `is_admin(_user_id UUID)`
Checks if user has 'admin' role in `user_roles` table.

### `has_role(_user_id UUID, _role app_role)`
Checks if user has specific role.

## Edge Functions

### `admin-create-user`
Creates admin/moderator users or company users from admin panel.

**Parameters:**
- `email` - User email
- `password` - User password
- `firstName`, `lastName` - User name
- `role` - Optional: 'admin' or 'moderator'
- `companyName` - Optional: If creating company user

## RLS Considerations

The `user_roles` table has RLS enabled. Users can only see their own roles.
This is why Auth.tsx queries with the authenticated user's context.

## Troubleshooting

### User sees "Keine Firma verknuepft" but should be admin
1. Check `user_roles` table for the user's entry
2. Run: `SELECT * FROM user_roles WHERE user_id = '<user_id>'`
3. If missing, insert: `INSERT INTO user_roles (user_id, role) VALUES ('<user_id>', 'admin')`

### Role not assigned after creation
Check Edge Function logs in Supabase Dashboard → Functions → admin-create-user → Logs

