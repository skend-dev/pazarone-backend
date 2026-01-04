# Admin Seller Freeze/Unfreeze Guide

## Overview

Admins can manually freeze or unfreeze seller accounts. This provides administrative control over seller payment restrictions, independent of invoice payment status.

## Endpoints

### Base URL

All endpoints are prefixed with `/api/admin/sellers`

### 1. Freeze Seller Account

**PUT** `/api/admin/sellers/:id/freeze`

Manually freeze a seller account. This applies payment restrictions regardless of invoice status.

**Path Parameters:**

- `id`: The UUID of the seller to freeze

**Response:**

- Status 200: Seller account frozen successfully
- Returns no body content (void response)

**Effects of Freezing:**

- Sets `paymentRestricted` flag to `true` in seller settings
- Sets `paymentRestrictedAt` timestamp to current date/time
- Deactivates all active products (sets status to INACTIVE)
- Blocks new order creation for this seller
- Products are hidden from public listings

**Error Responses:**

- 404: Seller not found
- 401: Unauthorized
- 403: Forbidden - admin access required

### 2. Unfreeze Seller Account

**PUT** `/api/admin/sellers/:id/unfreeze`

Manually unfreeze a seller account. This removes payment restrictions.

**Path Parameters:**

- `id`: The UUID of the seller to unfreeze

**Response:**

- Status 200: Seller account unfrozen successfully
- Returns no body content (void response)

**Effects of Unfreezing:**

- Sets `paymentRestricted` flag to `false` in seller settings
- Clears `paymentRestrictedAt` timestamp (sets to null)
- Allows new order creation for this seller
- **Important:** Products remain INACTIVE - seller must manually reactivate them

**Error Responses:**

- 404: Seller not found or seller settings not found
- 401: Unauthorized
- 403: Forbidden - admin access required

## Authentication

Both endpoints require:

- JWT authentication (Bearer token)
- Admin role (verified via `AdminAuthGuard`)

## Use Cases

### Freezing a Seller

- Seller has payment issues not related to invoices
- Administrative decision to temporarily suspend seller
- Dispute resolution requiring account suspension
- Compliance or legal reasons

### Unfreezing a Seller

- Issues have been resolved
- Administrative decision to restore seller access
- Dispute has been resolved

## Important Notes

1. **Manual Override**: Freeze/unfreeze operations are manual overrides that work independently of invoice payment status. If a seller is frozen manually, they remain frozen even if all invoices are paid.

2. **Product Status**: When unfreezing, products remain inactive. This is intentional - sellers must manually reactivate their products to ensure they review and approve their listings after being unfrozen.

3. **Automatic Restrictions**: Automatic payment restrictions (from overdue invoices) and manual freezes work independently. If a seller is manually frozen, they remain frozen even after paying invoices. If manually unfrozen but has overdue invoices, the system will automatically re-apply restrictions on the next daily check.

4. **Re-freezing**: A manually unfrozen seller can be automatically re-frozen if they have overdue invoices (via the daily overdue invoice check). The system checks invoice status daily and applies restrictions automatically.

5. **Combined Restrictions**: If a seller is both manually frozen and has overdue invoices, they remain restricted until both conditions are resolved (admin unfreezes AND all invoices are paid).

## UI/UX Recommendations

### Seller List View (Admin)

- Show payment restriction status indicator for each seller
- Display whether restriction is manual (admin freeze) or automatic (overdue invoice)
- Show badge/indicator if seller is frozen
- Add freeze/unfreeze action buttons

### Seller Detail View (Admin)

- Display current restriction status prominently
- Show restriction reason/type (manual vs automatic)
- Show `paymentRestrictedAt` timestamp if restricted
- Display freeze/unfreeze action buttons with confirmation dialog
- Show warning if seller has overdue invoices when unfreezing (they may be automatically re-frozen)

### Freeze Action

- Show confirmation dialog: "Are you sure you want to freeze this seller account?"
- List effects: "This will deactivate all products and block new orders"
- Optionally allow admin to add a reason/note (future enhancement)

### Unfreeze Action

- Show confirmation dialog: "Are you sure you want to unfreeze this seller account?"
- Show warning: "Products will remain inactive - seller must manually reactivate them"
- Show warning if seller has overdue invoices: "This seller has overdue invoices. Restrictions may be automatically re-applied."

## Integration Checklist

- [ ] Implement freeze seller endpoint call
- [ ] Implement unfreeze seller endpoint call
- [ ] Add freeze/unfreeze buttons to seller list view
- [ ] Add freeze/unfreeze buttons to seller detail view
- [ ] Display restriction status indicators
- [ ] Show restriction type (manual vs automatic)
- [ ] Add confirmation dialogs for freeze/unfreeze actions
- [ ] Handle 404, 401, 403 error responses
- [ ] Add loading states for freeze/unfreeze actions
- [ ] Update seller status after freeze/unfreeze
- [ ] Test freeze action and verify products are deactivated
- [ ] Test unfreeze action and verify products remain inactive
- [ ] Test with sellers who have overdue invoices

## Testing Scenarios

1. **Freeze Seller**: Verify seller is frozen, products deactivated, orders blocked
2. **Unfreeze Seller**: Verify restriction removed, orders allowed, products remain inactive
3. **Freeze Seller with Overdue Invoices**: Verify freeze works independently
4. **Unfreeze Seller with Overdue Invoices**: Verify warning shown, seller may be auto-re-frozen
5. **Freeze Non-existent Seller**: Verify 404 error
6. **Unfreeze Non-existent Seller**: Verify 404 error
7. **Auto Re-freeze After Manual Unfreeze**: Wait for daily check, verify seller is re-frozen if has overdue invoices
8. **Freeze Already Frozen Seller**: Should work without error (idempotent)
9. **Unfreeze Already Unfrozen Seller**: Should work without error (idempotent)

## Relationship with Invoice System

The freeze/unfreeze system works alongside the automatic invoice payment restriction system:

- **Automatic Restrictions**: Applied daily when invoices become overdue
- **Manual Freeze**: Applied immediately by admin action
- **Manual Unfreeze**: Removed immediately by admin action, but may be re-applied automatically if seller has overdue invoices

Both systems set the same `paymentRestricted` flag, so they share the same effects (blocked orders, hidden products). The difference is in how and when the restriction is applied.
