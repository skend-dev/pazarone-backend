# Frontend Update Guide

This document outlines the frontend changes required to work with the updated backend API.

## Table of Contents
1. [Bulk Image Upload Error Handling](#bulk-image-upload-error-handling)
2. [Seller Profile Link](#seller-profile-link)
3. [API Changes Summary](#api-changes-summary)

---

## Bulk Image Upload Error Handling

### What Changed
The bulk image upload endpoint now handles individual file failures gracefully. Instead of failing the entire request if one image fails, it will return successful uploads along with detailed error information for failed uploads.

### Updated Response Format

**Before:**
```json
{
  "images": [
    {
      "url": "https://res.cloudinary.com/...",
      "publicId": "pazarone/products/abc123",
      "width": 1000,
      "height": 1000,
      "bytes": 245678
    }
  ]
}
```

**After:**
```json
{
  "images": [
    {
      "url": "https://res.cloudinary.com/...",
      "publicId": "pazarone/products/abc123",
      "width": 1000,
      "height": 1000,
      "bytes": 245678
    }
  ],
  "errors": [
    {
      "fileName": "large-image.jpg",
      "error": "File \"large-image.jpg\" exceeds maximum size of 3MB (4.2MB)"
    },
    {
      "fileName": "document.pdf",
      "error": "File \"document.pdf\" has invalid type \"application/pdf\". Only image files (jpeg, jpg, png, gif, webp) are allowed."
    }
  ]
}
```

### Frontend Implementation

#### 1. Update Upload Handler

```typescript
// Example: Update your image upload handler
async function uploadImages(files: File[]) {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('images', file);
  });

  try {
    const response = await fetch('/api/cloudinary/images', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    const data = await response.json();
    
    // Handle successful uploads
    if (data.images && data.images.length > 0) {
      console.log(`Successfully uploaded ${data.images.length} image(s)`);
      // Process successful uploads
      data.images.forEach(image => {
        // Add to your image list
        addImageToList(image);
      });
    }

    // Handle errors (if any)
    if (data.errors && data.errors.length > 0) {
      console.warn(`${data.errors.length} image(s) failed to upload`);
      // Display errors to user
      data.errors.forEach(error => {
        showErrorNotification(`${error.fileName}: ${error.error}`);
      });
    }

    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}
```

#### 2. Update UI to Show Partial Success

```typescript
// Example: Show success/error messages
function handleUploadResponse(response: MultipleUploadResponseDto) {
  const successCount = response.images?.length || 0;
  const errorCount = response.errors?.length || 0;

  if (successCount > 0) {
    showSuccessMessage(`Successfully uploaded ${successCount} image(s)`);
  }

  if (errorCount > 0) {
    showWarningMessage(
      `${errorCount} image(s) failed to upload. Please check the file requirements.`
    );
    
    // Display detailed errors
    response.errors?.forEach(error => {
      console.error(`Failed: ${error.fileName} - ${error.error}`);
    });
  }

  if (successCount === 0 && errorCount > 0) {
    showErrorMessage('All uploads failed. Please check your files and try again.');
  }
}
```

#### 3. Update TypeScript Types

```typescript
// Update your types to match the new response format
interface UploadResponseDto {
  url: string;
  publicId: string;
  width: number;
  height: number;
  bytes: number;
}

interface UploadErrorDto {
  fileName: string;
  error: string;
}

interface MultipleUploadResponseDto {
  images: UploadResponseDto[];
  errors?: UploadErrorDto[]; // Optional - only present if some uploads failed
}
```

### User Experience Improvements

1. **Show Progress for Each File**: Display individual upload status for each file
2. **Display Specific Errors**: Show which files failed and why
3. **Allow Retry**: Provide option to retry failed uploads
4. **Validation Before Upload**: Validate file size and type on the frontend before upload

```typescript
// Example: Pre-upload validation
function validateFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 3 * 1024 * 1024; // 3MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds maximum size of 3MB (${(file.size / 1024 / 1024).toFixed(2)}MB)`
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File "${file.name}" has invalid type. Only image files are allowed.`
    };
  }

  return { valid: true };
}
```

---

## Seller Profile Link

### What Changed
- New public endpoint to get seller profile information
- Product responses now include `profileUrl` in the seller object
- Seller profile includes statistics (total products, active products, total views)

### New Endpoint

**GET** `/api/seller/:sellerId/profile`

**Response:**
```json
{
  "id": "uuid",
  "name": "Seller Name",
  "storeName": "Store Name",
  "storeDescription": "Store description",
  "logo": "https://res.cloudinary.com/...",
  "verified": true,
  "market": "MK",
  "shippingCountries": ["North Macedonia", "Kosovo"],
  "stats": {
    "totalProducts": 50,
    "activeProducts": 45,
    "totalViews": 1250
  },
  "profileUrl": "/seller/{sellerId}/profile",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Updated Product Response

Product objects now include `profileUrl` in the seller object:

```json
{
  "id": "product-uuid",
  "name": "Product Name",
  "seller": {
    "id": "seller-uuid",
    "name": "Seller Name",
    "email": "seller@example.com",
    "storeName": "Store Name",
    "storeLogo": "https://res.cloudinary.com/...",
    "profileUrl": "/seller/{sellerId}/profile"  // NEW FIELD
  }
}
```

### Frontend Implementation

#### 1. Add Seller Profile Link to Product Cards/Pages

```typescript
// Example: Product card component
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="product-card">
      <img src={product.images[0]} alt={product.name} />
      <h3>{product.name}</h3>
      
      {/* Add seller profile link */}
      <div className="seller-info">
        <img 
          src={product.seller.storeLogo || defaultLogo} 
          alt={product.seller.storeName || product.seller.name}
        />
        <a 
          href={product.seller.profileUrl}
          onClick={(e) => {
            e.preventDefault();
            navigate(product.seller.profileUrl);
          }}
        >
          {product.seller.storeName || product.seller.name}
        </a>
        {product.seller.verified && <VerifiedBadge />}
      </div>
    </div>
  );
}
```

#### 2. Create Seller Profile Page

```typescript
// Example: Seller profile page component
function SellerProfilePage({ sellerId }: { sellerId: string }) {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch(`/api/seller/${sellerId}/profile`);
        if (!response.ok) {
          throw new Error('Failed to load seller profile');
        }
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
        // Handle error
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [sellerId]);

  if (loading) return <LoadingSpinner />;
  if (!profile) return <NotFound />;

  return (
    <div className="seller-profile">
      <div className="profile-header">
        {profile.logo && (
          <img src={profile.logo} alt={profile.storeName || profile.name} />
        )}
        <div>
          <h1>{profile.storeName || profile.name}</h1>
          {profile.verified && <VerifiedBadge />}
          {profile.storeDescription && <p>{profile.storeDescription}</p>}
        </div>
      </div>

      <div className="profile-stats">
        <StatCard 
          label="Total Products" 
          value={profile.stats.totalProducts} 
        />
        <StatCard 
          label="Active Products" 
          value={profile.stats.activeProducts} 
        />
        <StatCard 
          label="Total Views" 
          value={profile.stats.totalViews} 
        />
      </div>

      <div className="shipping-info">
        <h3>Shipping Countries</h3>
        <ul>
          {profile.shippingCountries.map(country => (
            <li key={country}>{country}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

#### 3. Update TypeScript Types

```typescript
// Add seller profile types
interface SellerProfile {
  id: string;
  name: string;
  storeName: string | null;
  storeDescription: string | null;
  logo: string | null;
  verified: boolean;
  market: string;
  shippingCountries: string[];
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalViews: number;
  };
  profileUrl: string;
  createdAt: string;
}

// Update Product type to include profileUrl
interface Product {
  id: string;
  name: string;
  // ... other product fields
  seller: {
    id: string;
    name: string;
    email: string;
    storeName: string | null;
    storeLogo: string | null;
    profileUrl: string; // NEW FIELD
  };
}
```

#### 4. Add Routing

```typescript
// Example: Add route for seller profile
// React Router example
<Route path="/seller/:sellerId/profile" element={<SellerProfilePage />} />

// Next.js example
// pages/seller/[sellerId]/profile.tsx
export default function SellerProfilePage() {
  const router = useRouter();
  const { sellerId } = router.query;
  // ... component implementation
}
```

### UI/UX Recommendations

1. **Seller Badge/Link**: Add a clickable seller name/logo on product cards and product detail pages
2. **Verified Badge**: Display a verified badge if `seller.verified` is true
3. **Profile Page Design**: 
   - Show seller logo and store name prominently
   - Display statistics in cards or metrics
   - List shipping countries
   - Optionally show seller's products on the profile page
4. **Navigation**: Make seller links consistent across the app (product cards, product details, order history, etc.)

---

## API Changes Summary

### Endpoints

| Method | Endpoint | Change | Description |
|--------|----------|--------|-------------|
| POST | `/api/cloudinary/images` | Updated | Now returns `errors` array for failed uploads |
| GET | `/api/seller/:sellerId/profile` | New | Get seller public profile |

### Response Changes

| Endpoint | Field | Change | Description |
|----------|-------|--------|-------------|
| `POST /api/cloudinary/images` | `errors` | Added (optional) | Array of upload errors |
| `GET /api/products` | `seller.profileUrl` | Added | URL to seller profile |
| `GET /api/products/:id` | `seller.profileUrl` | Added | URL to seller profile |

### Error Handling

The bulk upload endpoint now:
- Returns HTTP 400 only if ALL uploads fail
- Returns HTTP 201 with partial success if some uploads succeed
- Includes detailed error messages for each failed file

---

## Migration Checklist

- [ ] Update image upload handler to handle `errors` array in response
- [ ] Update UI to show partial success/error messages
- [ ] Add seller profile link to product cards
- [ ] Add seller profile link to product detail pages
- [ ] Create seller profile page component
- [ ] Add routing for seller profile page
- [ ] Update TypeScript types for new response formats
- [ ] Test bulk image upload with mixed success/failure scenarios
- [ ] Test seller profile page with various seller data
- [ ] Update error handling for image uploads

---

## Testing Recommendations

### Bulk Image Upload
1. Test with all successful uploads
2. Test with all failed uploads (should return 400)
3. Test with mixed success/failure (should return 201 with errors array)
4. Test with files exceeding size limit
5. Test with invalid file types

### Seller Profile
1. Test with verified seller
2. Test with unverified seller
3. Test with seller that has no store name/logo
4. Test with seller that has all fields populated
5. Test navigation from product to seller profile

---

## Questions or Issues?

If you encounter any issues implementing these changes, please contact the backend team or refer to the API documentation at `/api/docs` (Swagger UI).
