# Frontend Integration Guide - Seller Payment Tracking

This guide provides information for integrating the seller payment tracking feature in the admin dashboard frontend.

## API Endpoints

### Base URL

All endpoints are prefixed with `/api/admin/sellers`

### Authentication

All endpoints require:

- **JWT Token** in the `Authorization` header: `Bearer <token>`
- **Admin Role** - User must be an admin

---

## 1. Get Seller Payment Summaries

**Endpoint:** `GET /api/admin/sellers/payments`

**Query Parameters:**

- `page` (number, optional, default: 1) - Page number
- `limit` (number, optional, default: 20) - Items per page
- `search` (string, optional) - Search by seller name or email
- `paymentMethod` (string, optional) - Filter by `"cod"` or `"card"`

**Response:**

```typescript
{
  summaries: Array<{
    sellerId: string;
    sellerName: string;
    sellerEmail: string;
    storeName: string | null;

    // COD outstanding (seller owes admin)
    codOutstanding: number; // Legacy: total in all currencies
    codOutstandingMKD: number; // Outstanding in MKD
    codOutstandingEUR: number; // Outstanding in EUR
    codOrderCount: number;

    // Card outstanding (admin owes seller)
    cardOutstanding: number; // Legacy: total in all currencies
    cardOutstandingMKD: number; // Outstanding in MKD
    cardOutstandingEUR: number; // Outstanding in EUR
    cardOrderCount: number;

    // Total outstanding (positive = admin owes, negative = seller owes)
    totalOutstanding: number; // Legacy: total in all currencies
    totalOutstandingMKD: number; // Total in MKD
    totalOutstandingEUR: number; // Total in EUR
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Example Request:**

```javascript
const response = await fetch(
  '/api/admin/sellers/payments?page=1&limit=20&paymentMethod=cod',
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
);
```

---

## 2. Get Seller Payment Orders

**Endpoint:** `GET /api/admin/sellers/:sellerId/payments/orders`

**URL Parameters:**

- `sellerId` (string, required) - The seller's user ID

**Query Parameters:**

- `page` (number, optional, default: 1)
- `limit` (number, optional, default: 20)
- `paymentMethod` (string, optional) - Filter by `"cod"` or `"card"`

**Response:**

```typescript
{
  orders: Array<{
    orderId: string;
    orderNumber: string;
    totalAmount: number; // Total in buyer currency
    totalAmountBase: number; // Total in seller's base currency
    buyerCurrency: 'MKD' | 'EUR';
    sellerBaseCurrency: 'MKD' | 'EUR';

    platformFee: number; // Legacy: total
    platformFeeMKD: number;
    platformFeeEUR: number;

    affiliateCommission: number; // Legacy: total
    affiliateCommissionMKD: number;
    affiliateCommissionEUR: number;

    sellerAmount: number; // Legacy: total
    sellerAmountMKD: number; // Amount seller should receive/owe in MKD
    sellerAmountEUR: number; // Amount seller should receive/owe in EUR

    paymentMethod: 'cod' | 'card';
    status: string; // Order status (should be "delivered")

    // Payment status fields
    sellerPaid: boolean; // For COD: whether seller has paid
    adminPaid: boolean; // For Card: whether admin has paid seller
    paymentSettledAt: string | null; // ISO date string when settled

    createdAt: string; // ISO date string
    deliveredAt?: string; // ISO date string
  }>;
  seller: {
    id: string;
    name: string;
    email: string;
    storeName: string | null;
  }
  summary: {
    totalOutstanding: number;
    totalOutstandingMKD: number;
    totalOutstandingEUR: number;
    codOutstanding: number;
    codOutstandingMKD: number;
    codOutstandingEUR: number;
    cardOutstanding: number;
    cardOutstandingMKD: number;
    cardOutstandingEUR: number;
  }
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}
```

**Example Request:**

```javascript
const sellerId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(
  `/api/admin/sellers/${sellerId}/payments/orders?paymentMethod=card&page=1`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  },
);
```

---

## 3. Mark COD Payments as Settled

**Endpoint:** `PUT /api/admin/sellers/:sellerId/payments/cod/settle`

**URL Parameters:**

- `sellerId` (string, required) - The seller's user ID

**Request Body:**

```typescript
{
  orderIds: string[]; // Array of order IDs to mark as settled
  notes?: string; // Optional notes about the settlement
}
```

**Response:**

```typescript
{
  message: string; // Success message
  orders: Array<{
    orderId: string;
    orderNumber: string;
    sellerPaid: boolean; // Should be true
    paymentSettledAt: string; // ISO date string
  }>;
  notes: string | null;
}
```

**Example Request:**

```javascript
const sellerId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(
  `/api/admin/sellers/${sellerId}/payments/cod/settle`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderIds: ['order-id-1', 'order-id-2'],
      notes: 'Payment received via bank transfer',
    }),
  },
);
```

---

## 4. Mark Card Payments as Settled

**Endpoint:** `PUT /api/admin/sellers/:sellerId/payments/card/settle`

**URL Parameters:**

- `sellerId` (string, required) - The seller's user ID

**Request Body:**

```typescript
{
  orderIds: string[]; // Array of order IDs to mark as settled
  notes?: string; // Optional notes about the settlement
}
```

**Response:**

```typescript
{
  message: string; // Success message
  orders: Array<{
    orderId: string;
    orderNumber: string;
    adminPaid: boolean; // Should be true
    paymentSettledAt: string; // ISO date string
  }>;
  notes: string | null;
}
```

**Example Request:**

```javascript
const sellerId = '123e4567-e89b-12d3-a456-426614174000';
const response = await fetch(
  `/api/admin/sellers/${sellerId}/payments/card/settle`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderIds: ['order-id-1', 'order-id-2'],
      notes: 'Payment processed to seller account',
    }),
  },
);
```

---

## UI/UX Recommendations

### Payment Summary Table

1. **Display columns:**
   - Seller Name / Email
   - Store Name
   - COD Outstanding (MKD/EUR)
   - Card Outstanding (MKD/EUR)
   - Total Outstanding (MKD/EUR)
   - Action buttons (View Orders)

2. **Visual indicators:**
   - Use color coding:
     - Red for COD outstanding (seller owes admin)
     - Green for Card outstanding (admin owes seller)
   - Show currency badges (MKD/EUR) next to amounts
   - Highlight sellers with outstanding amounts

3. **Filtering:**
   - Add filters for payment method (COD/Card/All)
   - Search by seller name or email
   - Add pagination controls

### Payment Orders View

1. **Order table columns:**
   - Order Number
   - Date (Created/Delivered)
   - Total Amount (with currency)
   - Platform Fee (MKD/EUR)
   - Affiliate Commission (MKD/EUR)
   - Seller Amount (MKD/EUR) - **highlight this**
   - Payment Status:
     - For COD: "Unpaid" / "Paid" badge with date
     - For Card: "Unpaid" / "Paid" badge with date
   - Checkbox for selection (for bulk actions)

2. **Actions:**
   - **Bulk Select**: Checkbox in header to select all
   - **Mark as Settled** button (disabled if no orders selected)
   - Show count of selected orders
   - Filter by payment method (COD/Card/All)

3. **Payment Status Badges:**

   ```typescript
   // For COD orders
   if (order.sellerPaid) {
     // Show: "Paid" badge (green) + paymentSettledAt date
   } else {
     // Show: "Unpaid" badge (red/orange)
   }

   // For Card orders
   if (order.adminPaid) {
     // Show: "Paid" badge (green) + paymentSettledAt date
   } else {
     // Show: "Unpaid" badge (red/orange)
   }
   ```

4. **Summary Panel:**
   - Display summary totals at top of page
   - Show breakdown by currency (MKD/EUR)
   - Highlight total outstanding amount

### Settlement Modal/Dialog

When clicking "Mark as Settled":

1. **Confirmation Dialog:**
   - List selected orders
   - Show total amount to be settled
   - Optional notes textarea
   - Cancel / Confirm buttons

2. **After Settlement:**
   - Show success message
   - Refresh the orders list
   - Update summary totals

### Error Handling

- Handle 404 errors (seller not found)
- Handle 400 errors (invalid order IDs)
- Show user-friendly error messages
- Validate order IDs before submission

---

## TypeScript Types

```typescript
// Payment Summary
interface SellerPaymentSummary {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  storeName: string | null;
  codOutstanding: number;
  codOutstandingMKD: number;
  codOutstandingEUR: number;
  codOrderCount: number;
  cardOutstanding: number;
  cardOutstandingMKD: number;
  cardOutstandingEUR: number;
  cardOrderCount: number;
  totalOutstanding: number;
  totalOutstandingMKD: number;
  totalOutstandingEUR: number;
}

interface PaymentSummariesResponse {
  summaries: SellerPaymentSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Payment Order
interface PaymentOrder {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  totalAmountBase: number;
  buyerCurrency: 'MKD' | 'EUR';
  sellerBaseCurrency: 'MKD' | 'EUR';
  platformFee: number;
  platformFeeMKD: number;
  platformFeeEUR: number;
  affiliateCommission: number;
  affiliateCommissionMKD: number;
  affiliateCommissionEUR: number;
  sellerAmount: number;
  sellerAmountMKD: number;
  sellerAmountEUR: number;
  paymentMethod: 'cod' | 'card';
  status: string;
  sellerPaid: boolean;
  adminPaid: boolean;
  paymentSettledAt: string | null;
  createdAt: string;
  deliveredAt?: string;
}

interface PaymentOrdersResponse {
  orders: PaymentOrder[];
  seller: {
    id: string;
    name: string;
    email: string;
    storeName: string | null;
  };
  summary: {
    totalOutstanding: number;
    totalOutstandingMKD: number;
    totalOutstandingEUR: number;
    codOutstanding: number;
    codOutstandingMKD: number;
    codOutstandingEUR: number;
    cardOutstanding: number;
    cardOutstandingMKD: number;
    cardOutstandingEUR: number;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Settlement Request/Response
interface MarkPaymentSettledRequest {
  orderIds: string[];
  notes?: string;
}

interface MarkPaymentSettledResponse {
  message: string;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    sellerPaid?: boolean; // For COD
    adminPaid?: boolean; // For Card
    paymentSettledAt: string;
  }>;
  notes: string | null;
}
```

---

## Example React Component Structure

```typescript
// PaymentSummariesPage.tsx
const PaymentSummariesPage = () => {
  const [summaries, setSummaries] = useState<SellerPaymentSummary[]>([]);
  const [filters, setFilters] = useState({ paymentMethod: null, search: '' });

  // Fetch summaries with filters
  // Display table with summaries
  // Navigate to order details on row click
};

// PaymentOrdersPage.tsx
const PaymentOrdersPage = ({ sellerId }: { sellerId: string }) => {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [summary, setSummary] = useState(null);

  // Fetch orders for seller
  // Display order table with checkboxes
  // Handle bulk selection
  // Mark as settled handler
};
```

---

## Notes

1. **Currency Handling**: Always display amounts with their respective currency labels (MKD/EUR)
2. **Payment Method Logic**:
   - COD: `sellerPaid` indicates if seller has paid the platform fees
   - Card: `adminPaid` indicates if admin has paid the seller
3. **Filtering**: Only delivered orders are included in payment tracking
4. **Real-time Updates**: After marking payments as settled, refresh the data to show updated statuses
5. **Bulk Operations**: The settle endpoint accepts multiple order IDs for efficient batch processing
