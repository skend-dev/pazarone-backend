# Authentication System Setup Guide

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database Configuration
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=pazaro_db

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_change_this_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Cloudinary Configuration (for image uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Telegram Bot Configuration (for seller order notifications)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Admin User Configuration (optional - for seeding super admin)
ADMIN_EMAIL=admin@pazarone.co
ADMIN_PASSWORD=admin123
ADMIN_NAME=Super Admin
```

## Database Setup

1. Make sure PostgreSQL is running
2. Create a database named `pazaro_db` (or your preferred name)

   **Option 1: Using psql command line**

   ```bash
   psql -U postgres -c "CREATE DATABASE pazaro_db;"
   ```

   **Option 2: Using SQL script**

   ```bash
   psql -U postgres -f scripts/create-database.sql
   ```

   **Option 3: Using psql interactive mode**

   ```bash
   psql -U postgres
   CREATE DATABASE pazaro_db;
   \q
   ```

3. Update the `.env` file with your database credentials
4. The application will automatically create the `users` table on first run (when `NODE_ENV` is not `production`)

## Cloudinary Setup (for Image Uploads)

1. Sign up for a free account at [Cloudinary](https://cloudinary.com/)
2. Get your credentials from the Cloudinary Dashboard:
   - Cloud Name
   - API Key
   - API Secret
3. Add these credentials to your `.env` file (see Environment Variables section above)
4. Images will be uploaded to the `pazarone/products` folder in your Cloudinary account

## Telegram Bot Setup (for Seller Notifications)

1. Create a Telegram bot by messaging [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` command and follow the instructions to create your bot
3. BotFather will provide you with a bot token (e.g., `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
4. Add the token to your `.env` file as `TELEGRAM_BOT_TOKEN`
5. Sellers can configure their Telegram chat ID in their settings:
   - Sellers need to start a conversation with your bot by sending `/start`
   - The bot will receive their chat ID automatically
   - Sellers can then update their settings via `PUT /api/seller/settings/notifications` with their `telegramChatId`
6. When a new order is created, sellers with Telegram notifications enabled will receive a formatted message with order details

**Note:** The Telegram bot token is optional. If not provided, the application will still work but Telegram notifications will be disabled.

## Running the Application

```bash
# Install dependencies (if not already done)
npm install

# Start in development mode
npm run start:dev

# Build for production
npm run build
npm run start:prod
```

## Creating Super Admin User

To create a super admin user, run the seed script:

```bash
npm run seed:admin
```

This will create a super admin user with the following default credentials:

- **Email:** `admin@pazarone.co` (or value from `ADMIN_EMAIL` env variable)
- **Password:** `admin123` (or value from `ADMIN_PASSWORD` env variable)
- **Name:** `Super Admin` (or value from `ADMIN_NAME` env variable)

**⚠️ Important:** Change the default password after first login!

You can customize the admin credentials by setting environment variables in your `.env` file:

```env
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Your Admin Name
```

If an admin user with the same email already exists, the script will update it to admin type or skip if it's already an admin.

## API Endpoints

### Authentication Endpoints

#### POST `/auth/signup`

Register a new user.

**Request Body:**

```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "password123",
  "userType": "seller" // or "affiliate"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "userType": "seller",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST `/auth/login`

Login with email and password.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** Same as signup response

#### POST `/auth/refresh`

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:** Same as signup response

#### GET `/auth/me`

Get current authenticated user (requires authentication).

**Headers:**

```
Authorization: Bearer <accessToken>
```

**Response:**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "userType": "seller",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Protecting Routes

To protect a route, use the `@UseGuards(JwtAuthGuard)` decorator and `@CurrentUser()` to get the authenticated user:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { CurrentUser } from './auth/decorators/current-user.decorator';
import { User } from './users/entities/user.entity';

@Controller('protected')
export class ProtectedController {
  @Get()
  @UseGuards(JwtAuthGuard)
  getProtectedData(@CurrentUser() user: User) {
    return { message: `Hello ${user.name}!` };
  }
}
```

## Frontend Integration

When making requests from your Next.js frontend:

1. Store the `accessToken` and `refreshToken` after login/signup
2. Include the access token in the `Authorization` header for protected routes:
   ```javascript
   fetch('http://localhost:3001/auth/me', {
     headers: {
       Authorization: `Bearer ${accessToken}`,
     },
   });
   ```
3. If the access token expires, use the refresh token to get a new one via `/auth/refresh`
4. Update your stored tokens with the new ones

## Image Upload Endpoints

### POST `/api/upload/images`

Upload product images to Cloudinary. Requires authentication.

**Headers:**

```
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

**Request:**

- Form data with field name `images` (array of image files)
- Maximum 10 files per request
- Maximum file size: 5MB
- Supported formats: JPEG, JPG, PNG, GIF, WEBP

**Response:**

```json
{
  "images": [
    {
      "url": "https://res.cloudinary.com/.../image1.jpg",
      "publicId": "pazarone/products/abc123",
      "width": 1000,
      "height": 800,
      "bytes": 245678
    }
  ]
}
```

**Usage Example:**

1. Upload images first using `/api/upload/images`
2. Use the returned URLs in the `images` array when creating/updating products via `/api/seller/products`
