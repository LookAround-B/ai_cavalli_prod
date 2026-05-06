# Ai Cavalli — System Design

## Overview

Ai Cavalli is a full-stack restaurant ordering system for a hotel. It handles the complete lifecycle from menu browsing and order placement (by guests and authenticated staff/riders) through kitchen preparation and billing. The system supports both walk-in guests (unauthenticated or session-based) and registered users (riders, staff, kitchen, admin).

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Language | TypeScript 5 |
| Database | PostgreSQL via Prisma ORM 6 |
| DB Driver | `pg` (direct) + `@prisma/adapter-pg` |
| Styling | CSS Modules + global CSS |
| Icons | lucide-react |
| Charts | recharts |
| Validation | zod |
| Analytics | Vercel Analytics + Speed Insights |
| Auth | Custom session-token + PIN auth (no Supabase, no NextAuth) |

---

## Directory Structure

```
app/
  (customer)/        # Authenticated customer routes (riders, staff)
    home/            # Home dashboard
    menu/            # Menu browsing
    cart/            # Cart review + checkout
    orders/          # Order history
    profile/         # User profile
  guest/             # Unauthenticated guest routes
    home/            # Guest landing
    menu/            # Menu browsing
    cart/            # Cart
    status/          # Order status tracking
  kitchen/           # Kitchen display system
    page.tsx         # Live order board
    specials/        # Manage daily specials
  admin/             # Admin panel
    menu/            # Menu + pricing management
    users/           # User management
    cms/             # Announcements / content
  api/               # Next.js API routes (all REST)
    auth/            # login, logout, refresh, guest-login
    orders/          # CRUD + status + discount + SSE stream
    bills/           # Generate, lookup, print, request, session
    menu/            # Menu items
    sessions/        # Guest session management
    kitchen/         # Kitchen-specific endpoints
    admin/           # Admin-only endpoints
  layout.tsx         # Root layout (AuthProvider, CartProvider)
  page.tsx           # Root redirect

components/
  home/              # GuestHome, StudentHome
  kitchen/           # MenuItemSelector
  layout/            # BottomNav, TopNav, PageHeader, AdminPageHeader
  ui/                # Reusable UI primitives

lib/
  auth/              # context.tsx, utils.ts, api-middleware.ts, protected-route.tsx
  context/           # CartContext.tsx
  hooks/             # useOrderStream.ts (SSE consumer)
  sse/               # manager.ts, pg-listener.ts, notify.ts
  database/          # prisma.ts singleton + SQL migration scripts
  types/             # auth.ts (roles, RBAC, route access)
  utils/             # email.ts, fetch-with-retry.ts, phone.ts, serialize-order.ts
  validation/        # sanitize.ts, schemas.ts (zod)

prisma/
  schema.prisma      # Canonical data model
```

---

## Data Model

### Core Entities

**User** — registered accounts (riders, staff, kitchen, admin). Phone is the unique identifier. PIN-based auth with bcrypt hashing. Session token stored in DB with expiry.

**GuestSession** — walk-in guests identified by phone + name + table. Tracks payment status, WhatsApp notification state, bill request status. One session can span multiple orders.

**Order** — belongs to either a User or a GuestSession (nullable foreign keys). Stores table name, location type (indoor/outdoor), number of guests, notes, discount, and `billed` flag. Status lifecycle: `pending → preparing → ready → completed | cancelled`.

**OrderItem** — line items for an order. Price is snapshotted at order time (not live from MenuItem).

**MenuItem / Category** — the menu. Categories have sort order. Items carry an `available` boolean flag.

**PriceHistory** — audit trail for price changes. Tracks old/new price, change type (percentage or absolute), who changed it, and reason.

**DailySpecial** — links a MenuItem to a date + period (breakfast/lunch). Unique per (date, period, menuItemId).

**Bill / BillItem** — billing record with sequential `billNumber`. Stores GST, discount, final total, payment method, payment status. BillItems snapshot the item name and price at bill generation time.

**Announcement** — CMS-managed content cards shown on the home page.

**OtpCode** — OTP storage for future OTP-based auth (currently PIN-based is primary).

### Key Relationships

```
User ──< Order ──< OrderItem >── MenuItem >── Category
     ──< GuestSession ──< Order
                       ──< Bill ──< BillItem
MenuItem ──< PriceHistory
         ──< DailySpecial
         ──< OrderItem
```

---

## Authentication & Authorization

### Auth Flow

Two login paths handled by `POST /api/auth/login`:

1. **PIN login** (`login_type: rider`) — phone + PIN → bcrypt verify → create session token in DB → return user + session
2. **Guest login** (`login_type: guest`) — phone + name + table → create/find User (OUTSIDER role) + GuestSession → return session

On success, the client (`AuthContext`) stores:
- `auth_user` in `localStorage`
- `session_token` in `localStorage`
- `auth_role`, `session_token`, `auth_user_id` as browser cookies (for middleware)

### Middleware

[middleware.ts](middleware.ts) runs on every non-asset request. It reads the `auth_role` cookie (set by client on login) and enforces `routeAccess` rules:
- Unauthenticated → redirect to `/home`
- Wrong role for route → redirect to role's home
- Login page + authenticated → redirect to role's home

### RBAC

Five roles defined in [lib/types/auth.ts](lib/types/auth.ts):

| Role | Access |
|---|---|
| `OUTSIDER` | Guest: view menu, create/view own orders, request bill |
| `RIDER` | Registered guest: same as OUTSIDER + profile |
| `STAFF` | Hotel staff: same as RIDER |
| `KITCHEN` | Kitchen display: view all orders, update status, manage specials |
| `ADMIN` | Full access including user management, menu, CMS, analytics |

Route access is declared as a static map (`routeAccess`) and enforced in both middleware (page routes) and API middleware ([lib/auth/api-middleware.ts](lib/auth/api-middleware.ts)).

---

## Real-Time Order Updates (SSE)

The kitchen display and order status pages use Server-Sent Events for live updates.

### Architecture

```
PostgreSQL NOTIFY (orders_events channel)
    ↓
pg-listener.ts  (one pg.Client per Node.js process, auto-reconnects)
    ↓
SSEManager (in-memory Map<clientId, ReadableStreamController>)
    ↓
GET /api/orders/stream  (one SSE connection per browser tab)
    ↓
useOrderStream hook  (EventSource + 3s reconnect backoff)
```

- **[lib/sse/pg-listener.ts](lib/sse/pg-listener.ts)** — boots once per process (guarded by `globalThis.__pgListenerStarted`). Listens on `orders_events` pg channel. On notification, parses payload and calls `sseManager.broadcast()`.
- **[lib/sse/manager.ts](lib/sse/manager.ts)** — singleton `SSEManager` (stored on `globalThis.__sseManager`). Broadcasts encoded SSE frames to all connected clients. Cleans up dead connections automatically.
- **[lib/sse/notify.ts](lib/sse/notify.ts)** — called from order mutation routes to fire `pg_notify`.
- **[lib/hooks/useOrderStream.ts](lib/hooks/useOrderStream.ts)** — React hook that connects `EventSource`, handles `order_created` and `order_updated` events, and reconnects on error.

### Fallback

The orders API supports **incremental polling** via `?since=<ISO timestamp>` and `?fields=minimal` for lightweight status-only polls. ETag-based 304 responses minimize bandwidth.

---

## Client State

### AuthContext ([lib/auth/context.tsx](lib/auth/context.tsx))

Manages auth lifecycle: login, guest login, logout, session refresh. Initializes from `localStorage` on mount. Exposes `hasRole()` and `hasPermission()` helpers.

### CartContext ([lib/context/CartContext.tsx](lib/context/CartContext.tsx))

Cart is stored in `localStorage` and synced on every change. Supports add, remove, update quantity, and clear. Also tracks `editingOrderId` for order editing flows. Cart survives logout intentionally.

---

## API Design

All API routes follow a consistent pattern:
- JSON responses with `{ success: boolean, data?: ..., error?: string }`
- Input sanitization via [lib/validation/sanitize.ts](lib/validation/sanitize.ts) before DB queries
- Auth checked via [lib/auth/api-middleware.ts](lib/auth/api-middleware.ts) (reads `session_token` or `auth_user_id` cookie)

### Key API Groups

| Prefix | Purpose |
|---|---|
| `/api/auth/` | Login, logout, session refresh, guest login |
| `/api/orders/` | List, create, update, status change, discount, item management, SSE stream |
| `/api/bills/` | Generate bill, lookup, print, request (by guest), session-level billing |
| `/api/menu/` | Menu items listing and management |
| `/api/kitchen/` | Bill requests view, daily specials, staff info |
| `/api/admin/` | User management, menu bulk price increase, announcements |
| `/api/sessions/` | Active session lookup, end session |

---

## User Flows

### Guest Ordering
1. Land on `/guest/home` → fill phone, name, table → `POST /api/auth/login` (guest)
2. Browse `/guest/menu` → add items to cart (CartContext + localStorage)
3. `/guest/cart` → review → `POST /api/orders/create`
4. `/guest/status` → real-time status via `useOrderStream`
5. Request bill → `POST /api/bills/request`

### Kitchen Workflow
1. Login as KITCHEN/ADMIN → `/kitchen`
2. `useOrderStream` subscribes to SSE → live order cards appear
3. Change status (pending → preparing → ready → completed) via `PATCH /api/orders/status`
4. Mark bills and manage daily specials at `/kitchen/specials`

### Admin Workflow
- Manage users at `/admin/users`
- Bulk price increase at `/admin/menu/price-increase` → `POST /api/admin/menu/bulk-price-increase`
- CMS/Announcements at `/admin/cms`

---

## Security Notes

- Passwords/PINs are bcrypt-hashed (never stored in plaintext)
- Session tokens are opaque random strings stored in DB with expiry
- All user inputs pass through sanitize functions before reaching Prisma
- Middleware enforces RBAC at the routing layer; API routes enforce it again independently
- Auth cookies use `SameSite=Lax`; session tokens are not `HttpOnly` (stored in localStorage as well — a known trade-off for this architecture)
- Account lockout after failed PIN attempts (`failedLoginAttempts`, `lockedUntil` fields)
