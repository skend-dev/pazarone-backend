# Weekly Invoice System - Implementation Notes

## Overview

This document outlines the implementation of the weekly invoice system for COD orders with payment enforcement.

## What Was Implemented

### 1. Database Entities

- **Invoice Entity** (`src/invoice/entities/invoice.entity.ts`)
  - Stores invoice information (invoice number, dates, amounts, status)
  - Links to seller and contains invoice items
  - Tracks payment status (PENDING, PAID, OVERDUE, CANCELLED)

- **InvoiceItem Entity** (`src/invoice/entities/invoice-item.entity.ts`)
  - Stores individual order line items within an invoice
  - Contains order details, fees, and amounts owed

- **SellerSettings Entity** (Updated)
  - Added `paymentRestricted` flag
  - Added `paymentRestrictedAt` timestamp

### 2. Services

- **InvoiceService** (`src/invoice/invoice.service.ts`)
  - `generateWeeklyInvoices()` - Generates invoices for all sellers
  - `generateInvoiceForSeller()` - Generates invoice for a specific seller
  - `getSellerInvoices()` - Retrieves invoices for a seller
  - `getInvoiceById()` - Gets invoice details
  - `markInvoiceAsPaid()` - Marks invoice as paid
  - `updateOverdueInvoices()` - Updates invoice status to OVERDUE
  - `updateSellerPaymentRestriction()` - Enforces payment restrictions
  - `canSellerCreateOrders()` - Checks if seller can create orders

- **InvoiceSchedulerService** (`src/invoice/invoice-scheduler.service.ts`)
  - Scheduled task to generate invoices every Monday at 00:00
  - Scheduled task to update overdue invoices daily at 01:00

### 3. Controllers

- **InvoiceController** (`src/invoice/invoice.controller.ts`)
  - Seller endpoints:
    - `GET /invoices/seller/my-invoices` - Get seller's invoices
    - `GET /invoices/seller/:invoiceId` - Get invoice details
    - `PUT /invoices/seller/:invoiceId/mark-paid` - Mark invoice as paid
  - Admin endpoints:
    - `GET /invoices/admin/seller/:sellerId` - Get seller invoices (admin)
    - `GET /invoices/admin/:invoiceId` - Get invoice details (admin)

### 4. Authentication Guards

- **SellerAuthGuard** (`src/auth/guards/seller-auth.guard.ts`)
  - Verifies user is a seller

## Weekly Invoice Generation Flow

1. **Every Monday at 00:00** - Scheduler triggers invoice generation
2. **For each seller:**
   - Finds all delivered COD orders from previous week (Mon-Sun)
   - Filters only unpaid orders (`sellerPaid = false`)
   - Calculates platform fees and affiliate commissions
   - Creates invoice with invoice items
   - Sets due date to Friday (5 days later)
3. **Every day at 01:00** - Updates overdue invoices (past due date)

## Payment Enforcement

When seller has overdue invoices:

- `paymentRestricted` flag is set to `true`
- All active products are set to `INACTIVE` (hidden)
- New orders are blocked (needs integration - see below)

When invoice is paid:

- `paymentRestricted` flag is set to `false`
- Invoice status updated to PAID
- Orders marked as paid (`sellerPaid = true`)
- Products remain inactive (they were set to INACTIVE when restriction was applied - requires manual reactivation or additional logic to restore previous status)

## Required Integration Steps

### 1. Install @nestjs/schedule Package

```bash
npm install @nestjs/schedule
```

**Status:** ✅ Not yet installed - required for scheduled tasks

### 2. Enforcement Checks

**Status:** ✅ **COMPLETED**

- **Order Creation Enforcement:** Added check in `src/orders/orders.service.ts` using `SellerSettingsService.hasPaymentRestriction()`
- **Product Listing Enforcement:** Added filter in `src/products/products.service.ts` `findAllPublic()` method to exclude products from restricted sellers

### 3. Update App Module

**Status:** ✅ **COMPLETED**

- InvoiceModule has been added to `app.module.ts`
- Invoice and InvoiceItem entities have been added to TypeORM entities array

### 5. Database Migration

You'll need to create a migration for:

- `invoices` table
- `invoice_items` table
- New columns in `seller_settings` table:
  - `paymentRestricted` (boolean, default: false)
  - `paymentRestrictedAt` (timestamp, nullable)

### 5. Product Reactivation Logic (Optional Enhancement)

When payment restriction is removed, you may want to automatically reactivate products that were active before restriction. This requires tracking which products were active before restriction (could use a separate table or status history).

## Invoice Number Format

Format: `INV-YYYY-WW-SELLERID`

- Example: `INV-2024-03-abc123de`

Where:

- `YYYY` = Year (e.g., 2024)
- `WW` = ISO week number (e.g., 03)
- `SELLERID` = First 8 characters of seller UUID

## Invoice Fields

Each invoice includes:

- Invoice number
- Week start/end dates
- Due date (Friday, 5 days after generation)
- Total amount owed (MKD/EUR breakdown)
- Status (PENDING/PAID/OVERDUE/CANCELLED)
- Invoice items (orders) with:
  - Order ID and number
  - Delivery date
  - Product price (COD amount)
  - Platform fee (% and amount)
  - Affiliate fee (% and amount, if applicable)
  - Total owed

## API Endpoints Summary

### Seller Endpoints (Require Seller Authentication)

- `GET /api/invoices/seller/my-invoices` - List invoices
- `GET /api/invoices/seller/:invoiceId` - Get invoice details
- `PUT /api/invoices/seller/:invoiceId/mark-paid` - Mark as paid

### Admin Endpoints (Require Admin Authentication)

- `GET /api/invoices/admin/seller/:sellerId` - List seller invoices
- `GET /api/invoices/admin/:invoiceId` - Get invoice details

## Notes

1. **Invoice Generation Timing**: Currently set to Monday 00:00. This generates invoices for the previous week (Mon-Sun).

2. **Due Date Calculation**: Set to Friday (5 days after Monday). Can be adjusted in `calculateDueDate()` method.

3. **Order Delivery Detection**: Uses `order.updatedAt` to determine when order was marked as DELIVERED. This assumes orders are updated when status changes to DELIVERED.

4. **Payment Restriction Logic**: Products are set to INACTIVE when restriction is applied. Consider adding logic to track previous status for restoration.

5. **Currency Support**: Full multi-currency support (MKD/EUR) for all amounts.

6. **Performance**: Invoice generation processes sellers sequentially. For large numbers of sellers, consider batch processing or parallel execution.

7. **Error Handling**: Invoice generation continues even if one seller fails. Errors are logged.

## Testing Recommendations

1. Test invoice generation with various order scenarios
2. Test overdue invoice detection and restriction application
3. Test payment marking and restriction removal
4. Test order creation blocking when restricted
5. Test product visibility filtering
6. Test weekly invoice generation schedule
7. Test edge cases (no orders, all paid orders, etc.)
