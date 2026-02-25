

# TradeZella – MVP Foundation Plan

## Overview
A clean trading journal platform with Supabase authentication, protected routes, and a sidebar-based layout supporting both dark and light themes.

---

## 1. Database Schema (Supabase Migrations)
Create the following tables with Row-Level Security (RLS) policies so users can only access their own data:

- **broker_accounts** – stores connected broker info (broker name, account number, active status)
- **trades** – stores individual trade records (symbol, direction, entry/exit prices, PnL, strategy, notes)
- **portfolio_snapshots** – stores daily balance snapshots for future charting

Each table links to `auth.users(id)` with cascade delete. RLS ensures users only see their own rows.

> Note: No separate profiles table – we'll use Supabase's built-in user metadata for display name etc.

---

## 2. Authentication Pages
A simple, branded auth page at the root (`/`) with:
- **Login form** – email & password
- **Sign up form** – email & password with confirmation
- **Password reset flow** – forgot password link + `/reset-password` page
- TradeZella branding/logo
- Toggle between login and signup views

---

## 3. App Layout & Navigation
After login, users land in a **sidebar-based layout** with:
- **Sidebar navigation** with icons for: Dashboard, Trade Journal, Settings
- Sidebar is collapsible to a mini icon-only mode
- **Header bar** with sidebar toggle, theme switcher (dark/light), and user menu (logout)
- Active route highlighting in sidebar
- Fully responsive – collapses on mobile

---

## 4. Theme Support
- Dark and light mode with a toggle in the header
- Dark theme styled with trading-platform aesthetics (dark backgrounds, accent colors)
- Light theme clean and minimal
- Persisted preference via `next-themes`

---

## 5. Protected Routes & Routing
- `/` – Auth page (login/signup), redirects to dashboard if already logged in
- `/dashboard` – Main dashboard (protected)
- `/journal` – Trade journal page (protected)
- `/settings` – Settings/broker connection page (protected)
- `/reset-password` – Password reset page (public)
- Auth guard component that redirects unauthenticated users to login

---

## 6. Dashboard Page
A welcoming dashboard with:
- Greeting with user's email
- Summary cards (placeholders for now): Total Trades, Win Rate, Total P&L, Account Balance
- Empty state messaging encouraging users to connect a broker or add trades
- Clean card-based layout

---

## 7. Trade Journal Page
- Empty state view with illustration/icon
- Message prompting users to import or add their first trade
- Placeholder for future trade table/list

---

## 8. Settings Page
- **Broker Accounts section** – list connected brokers, add new broker form (broker name + account number)
- **Account section** – display user email, logout button
- Basic CRUD for broker accounts using Supabase + TanStack Query

---

## 9. Supabase Client & API Layer
- Supabase client configured and shared across the app
- TanStack Query hooks for: broker accounts (list, create, delete), auth state management
- Auth state listener (`onAuthStateChange`) set up before `getSession()`
- Reusable query patterns for future trade data

