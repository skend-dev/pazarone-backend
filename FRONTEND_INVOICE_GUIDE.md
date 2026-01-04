# Frontend Integration Guide - Weekly Invoice System

## Overview

This guide explains how to integrate the weekly invoice system into your frontend application. The invoice system automatically generates weekly invoices for sellers based on delivered COD orders, tracks payment status, and enforces payment restrictions.

## Understanding the Invoice Flow

### Weekly Cycle

**Monday to Sunday**: Orders are delivered during the week
**Monday at 00:00**: System automatically generates invoices for the previous week's delivered COD orders
**Friday**: Payment deadline (sellers have 3-5 days to pay after invoice generation)
**Daily at 01:00**: System checks for overdue invoices and applies restrictions automatically

### Invoice Statuses

- **PENDING**: Invoice has been generated and is awaiting payment (within payment deadline)
- **PAID**: Invoice has been marked as paid by the seller
- **OVERDUE**: Invoice has passed its due date without payment (triggers restrictions)
- **CANCELLED**: Invoice has been cancelled (rarely used)

### Payment Restrictions

When a seller has overdue invoices, the following restrictions are automatically applied:

- New orders cannot be created for that seller
- All active product listings are hidden from public view
- Products are automatically set to inactive status
- Seller account is flagged with payment restriction status

When invoice is paid, restrictions are removed, but products need to be manually reactivated (they remain inactive until seller reactivates them).

## API Endpoints

### Base URL

All endpoints are prefixed with `/api/invoices`

### Seller Endpoints (Requires Seller Authentication)

#### 1. Get My Invoices

**GET** `/api/invoices/seller/my-invoices`

Get a paginated list of all invoices for the authenticated seller.

**Query Parameters:**

- `page` (optional): Page number, default is 1
- `limit` (optional): Number of items per page, default is 20
- `status` (optional): Filter by invoice status - can be `pending`, `paid`, `overdue`, or `cancelled`

**Response:**

- Returns an object with:
  - `invoices`: Array of invoice objects
  - `pagination`: Object containing `page`, `limit`, `total`, and `totalPages`

**Invoice Object Structure:**

- `id`: Unique invoice identifier (UUID)
- `invoiceNumber`: Human-readable invoice number (format: INV-YYYY-WW-SELLERID)
- `sellerId`: Seller identifier
- `weekStartDate`: Start date of the invoice week (Monday)
- `weekEndDate`: End date of the invoice week (Sunday)
- `dueDate`: Payment deadline date (Friday)
- `status`: Current invoice status
- `totalAmount`: Total amount owed (combined MKD and EUR)
- `totalAmountMKD`: Total amount in MKD currency
- `totalAmountEUR`: Total amount in EUR currency
- `orderCount`: Number of orders included in this invoice
- `items`: Array of invoice items (order details)
- `paidAt`: Timestamp when invoice was paid (null if not paid)
- `paymentNotes`: Notes provided when marking invoice as paid
- `createdAt`: Invoice creation timestamp
- `updatedAt`: Last update timestamp

**Invoice Item Object Structure:**

- `id`: Invoice item identifier
- `orderId`: Associated order identifier
- `orderNumber`: Human-readable order number
- `deliveryDate`: Date when order was delivered
- `productPrice`: COD amount for the order
- `productPriceMKD`: Product price in MKD (null if EUR)
- `productPriceEUR`: Product price in EUR (null if MKD)
- `platformFeePercent`: Platform fee percentage
- `platformFee`: Platform fee amount
- `platformFeeMKD`: Platform fee in MKD (null if EUR)
- `platformFeeEUR`: Platform fee in EUR (null if MKD)
- `affiliateFeePercent`: Affiliate commission percentage (null if no affiliate)
- `affiliateFee`: Affiliate commission amount
- `affiliateFeeMKD`: Affiliate commission in MKD (null if EUR or no affiliate)
- `affiliateFeeEUR`: Affiliate commission in EUR (null if MKD or no affiliate)
- `totalOwed`: Total amount seller owes for this order (platform fee + affiliate fee)
- `totalOwedMKD`: Total owed in MKD (null if EUR)
- `totalOwedEUR`: Total owed in EUR (null if MKD)

#### 2. Get Invoice Details

**GET** `/api/invoices/seller/:invoiceId`

Get detailed information about a specific invoice including all order items.

**Path Parameters:**

- `invoiceId`: The UUID of the invoice to retrieve

**Response:**

- Returns a single invoice object with complete details including all items

**Error Responses:**

- 404: Invoice not found
- 401: Unauthorized (not authenticated or not the invoice owner)

#### 3. Mark Invoice as Paid

**PUT** `/api/invoices/seller/:invoiceId/mark-paid`

Mark an invoice as paid. This should be called when seller confirms they have paid the invoice amount.

**Path Parameters:**

- `invoiceId`: The UUID of the invoice to mark as paid

**Request Body:**

- `paymentNotes` (optional): Any notes or payment reference information (string)

**Response:**

- Returns the updated invoice object with status set to PAID

**Error Responses:**

- 400: Invoice is already marked as paid
- 404: Invoice not found
- 401: Unauthorized

**Important Notes:**

- This endpoint updates the invoice status to PAID
- It automatically marks all associated orders as paid
- It removes payment restrictions if this was the last overdue invoice
- Products remain inactive after payment - seller needs to manually reactivate them

### Admin Endpoints (Requires Admin Authentication)

#### 4. Get Seller Invoices (Admin)

**GET** `/api/invoices/admin/seller/:sellerId`

Get all invoices for a specific seller (admin view).

**Path Parameters:**

- `sellerId`: The UUID of the seller

**Query Parameters:**

- Same as seller endpoint: `page`, `limit`, `status`

**Response:**

- Same structure as seller endpoint response

#### 5. Get Invoice Details (Admin)

**GET** `/api/invoices/admin/:invoiceId`

Get detailed information about any invoice (admin view).

**Path Parameters:**

- `invoiceId`: The UUID of the invoice

**Response:**

- Same structure as seller invoice details endpoint

#### 6. Mark Invoice as Paid (Admin)

**PUT** `/api/invoices/admin/:invoiceId/mark-paid`

Mark any invoice as paid by admin. This allows admins to mark invoices as paid on behalf of sellers, typically when payment confirmation is received.

**Path Parameters:**

- `invoiceId`: The UUID of the invoice to mark as paid

**Request Body:**

- `paymentNotes` (optional): Any notes or payment reference information (string)

**Response:**

- Returns the updated invoice object with status set to PAID

**Error Responses:**

- 400: Invoice is already marked as paid
- 404: Invoice not found
- 401: Unauthorized
- 403: Forbidden - admin access required

**Important Notes:**

- This endpoint works the same as the seller endpoint but doesn't require the invoice to belong to the authenticated user
- Admin can mark any invoice as paid
- It automatically marks all associated orders as paid
- It removes payment restrictions if this was the last overdue invoice
- Products remain inactive after payment - seller needs to manually reactivate them

## Authentication

All endpoints require JWT authentication. Include the JWT token in the Authorization header:

- Format: `Bearer <token>`
- Header name: `Authorization`

Seller endpoints require the authenticated user to be a seller. Admin endpoints require admin role.

## Error Handling

### Common HTTP Status Codes

- **200 OK**: Request successful
- **400 Bad Request**: Invalid request (e.g., invoice already paid)
- **401 Unauthorized**: Authentication required or invalid token
- **403 Forbidden**: User doesn't have required role (seller/admin)
- **404 Not Found**: Invoice or seller not found

### Error Response Structure

Errors typically return a JSON object with:

- `statusCode`: HTTP status code
- `message`: Error message describing what went wrong
- `error`: Error type (e.g., "Bad Request", "Unauthorized")

## UI/UX Recommendations

### Seller Invoice Dashboard

**Invoice List View:**

- Display invoices in a table or card layout
- Show key information: invoice number, week period, total amount, status, due date
- Use color coding for status:
  - Green for PAID
  - Yellow/Orange for PENDING (with days until due)
  - Red for OVERDUE
- Include filters for status (pending, paid, overdue)
- Add pagination controls
- Make invoice number clickable to view details

**Invoice Detail View:**

- Display full invoice information at the top
- Show breakdown of amounts by currency (MKD/EUR)
- List all orders included in the invoice as a table
- For each order, show:
  - Order number (linkable to order details if available)
  - Delivery date
  - Product price (COD amount)
  - Platform fee (percentage and amount)
  - Affiliate fee (percentage and amount, if applicable)
  - Total owed for that order
- Include a "Mark as Paid" button if status is PENDING or OVERDUE
- Show payment notes field when marking as paid
- Display payment confirmation after marking as paid

**Payment Restriction Warning:**

- If seller has overdue invoices, show a prominent warning banner
- Display list of overdue invoices with links to view/pay
- Explain restrictions: "You cannot create new orders until overdue invoices are paid"
- Show countdown/days overdue for each invoice
- Provide easy access to payment/pay functionality

### Admin Invoice View

**Seller Invoice List:**

- Similar to seller view but for any seller
- Include seller information (name, email, store name)
- Add filter by seller ID or search by seller name
- Show payment restriction status indicator
- Add ability to view seller details

**Invoice Detail View (Admin):**

- Display full invoice information including seller details
- Show all order breakdowns as in seller view
- Include a "Mark as Paid" button if status is PENDING or OVERDUE
- Allow admin to add payment notes when marking as paid
- This is useful when admin receives payment confirmation from seller and needs to update the invoice status
- Show confirmation after marking invoice as paid

### Notifications

**Recommended Notifications:**

- When new invoice is generated (Monday)
- When invoice is approaching due date (e.g., 2 days before)
- When invoice becomes overdue
- When payment restriction is applied
- When payment restriction is removed (after payment)

**Notification Content:**

- Invoice number
- Amount due
- Due date or days overdue
- Link to view invoice details

## Important Business Rules

### Invoice Generation

- Invoices are generated automatically every Monday at 00:00
- Only includes COD orders with status DELIVERED from the previous week
- Only includes orders that haven't been paid yet (sellerPaid = false)
- One invoice per seller per week
- If no COD orders were delivered, no invoice is generated

### Payment Deadlines

- Invoices are due on Friday (5 days after generation)
- Default deadline is 5 days, but this can be configured (3-5 days range)
- Payment is considered overdue after the due date passes

### Currency Handling

- All amounts are tracked separately in MKD and EUR
- Total amounts may be in one currency or split between both
- Display amounts in seller's base currency primarily
- Show breakdown if amounts exist in both currencies

### Payment Restrictions

- Restrictions are applied automatically when invoice becomes overdue
- Restrictions are removed automatically when all overdue invoices are paid
- Products are set to inactive when restrictions are applied
- Products remain inactive after restrictions are removed (requires manual reactivation)

### Order Payment Tracking

- When invoice is marked as paid, all associated orders are also marked as paid
- This updates the order's sellerPaid flag to true
- This sets the paymentSettledAt timestamp on orders

## Integration Checklist

- [ ] Set up API client with authentication
- [ ] Implement invoice list view for sellers
- [ ] Implement invoice detail view
- [ ] Implement "mark as paid" functionality for sellers
- [ ] Add payment restriction warnings
- [ ] Display invoice status indicators
- [ ] Handle multi-currency display
- [ ] Implement pagination for invoice lists
- [ ] Add filtering by invoice status
- [ ] Display order breakdown in invoice details
- [ ] Show payment deadline countdown
- [ ] Handle error states (404, 401, 403, 400)
- [ ] Add loading states for API calls
- [ ] Implement invoice notifications
- [ ] Add admin invoice views (if applicable)
- [ ] Implement admin "mark as paid" functionality
- [ ] Test with various invoice statuses
- [ ] Test payment flow end-to-end (seller and admin)
- [ ] Test payment restriction scenarios

## Testing Scenarios

1. **View Invoice List**: Test pagination, filtering, and status display
2. **View Invoice Details**: Verify all order items and amounts are displayed correctly
3. **Mark Invoice as Paid (Seller)**: Test seller payment flow and verify status update
4. **Mark Invoice as Paid (Admin)**: Test admin marking invoice as paid and verify status update
5. **Overdue Invoice**: Verify overdue status is displayed correctly and restrictions are shown
6. **Payment Restriction**: Verify warning messages and blocked actions
7. **Currency Display**: Test with invoices containing MKD, EUR, and mixed currencies
8. **Empty States**: Test when seller has no invoices
9. **Error Handling**: Test 404, 401, 403, and 400 error responses
10. **Multi-Week View**: Verify invoices from different weeks are displayed correctly
11. **Invoice Number Format**: Verify invoice numbers follow the INV-YYYY-WW-SELLERID format
12. **Admin Invoice Access**: Verify admin can view and mark paid any seller's invoice

## Questions to Consider

1. How will sellers be notified of new invoices?
2. What payment methods will sellers use? (This affects the payment notes field)
3. Should there be a payment confirmation/verification step?
4. How will you handle invoice PDF generation/export?
5. Do you need invoice history/archival functionality?
6. Should there be invoice search functionality?
7. How will you display currency conversion if needed?
8. What happens if seller tries to create order while restricted?
9. Should there be payment reminders before due date?
10. How will product reactivation work after payment?

## Additional Notes

- Invoice numbers are unique and follow a predictable format
- Week numbers use ISO week numbering
- All dates are in ISO 8601 format
- Currency amounts are stored as decimals with appropriate precision
- Invoice generation happens automatically - no manual trigger needed
- The system handles multi-currency calculations automatically
- Payment restrictions are applied/removed automatically by the system
- Invoice status can change from PENDING to OVERDUE automatically (daily check)
