import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { categorySeedData } from '../categories/categories.seed';
import { CategoryType } from '../categories/entities/category.entity';

export class InitialMigration1767895004988 implements MigrationInterface {
  name = 'InitialMigration1767895004988';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension for PostgreSQL
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create enums
    await queryRunner.query(
      `CREATE TYPE "user_type_enum" AS ENUM('seller', 'affiliate', 'customer', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "category_type_enum" AS ENUM('primary', 'secondary', 'subcategory')`,
    );
    await queryRunner.query(
      `CREATE TYPE "product_status_enum" AS ENUM('active', 'out_of_stock', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "order_status_enum" AS ENUM('pending', 'processing', 'in_transit', 'delivered', 'cancelled', 'returned')`,
    );
    await queryRunner.query(
      `CREATE TYPE "commission_status_enum" AS ENUM('pending', 'approved', 'paid', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "withdrawal_status_enum" AS ENUM('pending', 'approved', 'rejected', 'paid')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_type_enum" AS ENUM('order_created', 'order_updated', 'order_cancelled', 'order_completed', 'product_approved', 'product_rejected', 'product_low_stock', 'review_received', 'affiliate_commission', 'withdrawal_approved', 'withdrawal_rejected', 'system_announcement')`,
    );
    await queryRunner.query(
      `CREATE TYPE "notification_status_enum" AS ENUM('unread', 'read')`,
    );
    await queryRunner.query(
      `CREATE TYPE "invoice_status_enum" AS ENUM('pending', 'paid', 'overdue', 'cancelled')`,
    );

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL,
        "name" varchar NOT NULL,
        "phone" varchar,
        "password" varchar NOT NULL,
        "userType" "user_type_enum" NOT NULL DEFAULT 'seller',
        "market" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`,
    );

    // Create categories table
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "translations" jsonb,
        "slug" varchar NOT NULL,
        "icon" varchar NOT NULL,
        "type" "category_type_enum" NOT NULL DEFAULT 'primary',
        "parentId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug"),
        CONSTRAINT "PK_categories" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_slug" ON "categories" ("slug")`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_parentId" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create platform_settings table
    await queryRunner.query(`
      CREATE TABLE "platform_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" varchar NOT NULL DEFAULT 'main',
        "affiliateMinWithdrawalThreshold" decimal(10,2) NOT NULL DEFAULT 1000,
        "affiliateCommissionMin" decimal(5,2) NOT NULL DEFAULT 0,
        "affiliateCommissionMax" decimal(5,2) NOT NULL DEFAULT 100,
        "platformFeePercent" decimal(5,2) NOT NULL DEFAULT 7.0,
        "bankTransferDetails" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_platform_settings_key" UNIQUE ("key"),
        CONSTRAINT "PK_platform_settings" PRIMARY KEY ("id")
      )
    `);

    // Create email_verifications table
    await queryRunner.query(`
      CREATE TABLE "email_verifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL,
        "code" varchar NOT NULL,
        "token" varchar,
        "expiresAt" TIMESTAMP NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "verifiedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verifications_email" ON "email_verifications" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verifications_email_code" ON "email_verifications" ("email", "code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_verifications_email_token" ON "email_verifications" ("email", "token")`,
    );

    // Create password_resets table
    await queryRunner.query(`
      CREATE TABLE "password_resets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "email" varchar NOT NULL,
        "token" varchar NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "usedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_password_resets_token" UNIQUE ("token"),
        CONSTRAINT "PK_password_resets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_password_resets_userId" ON "password_resets" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_resets_email" ON "password_resets" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_password_resets_token" ON "password_resets" ("token")`,
    );
    await queryRunner.query(
      `ALTER TABLE "password_resets" ADD CONSTRAINT "FK_password_resets_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create seller_settings table
    await queryRunner.query(`
      CREATE TABLE "seller_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sellerId" uuid NOT NULL,
        "phone" varchar,
        "storeName" varchar,
        "storeDescription" text,
        "logo" varchar,
        "bankAccount" varchar,
        "bankName" varchar,
        "accountNumber" varchar,
        "accountHolder" varchar,
        "iban" varchar,
        "swift" varchar,
        "taxId" varchar,
        "accountVerified" boolean NOT NULL DEFAULT false,
        "verified" boolean NOT NULL DEFAULT false,
        "platformFeePercent" decimal(5,2),
        "shippingCountries" text,
        "notificationsOrders" boolean NOT NULL DEFAULT true,
        "notificationsReviews" boolean NOT NULL DEFAULT true,
        "notificationsMessages" boolean NOT NULL DEFAULT true,
        "notificationsPromotions" boolean NOT NULL DEFAULT true,
        "telegramChatId" varchar,
        "paymentRestricted" boolean NOT NULL DEFAULT false,
        "paymentRestrictedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_seller_settings_sellerId" UNIQUE ("sellerId"),
        CONSTRAINT "PK_seller_settings" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "seller_settings" ADD CONSTRAINT "FK_seller_settings_sellerId" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create customer_addresses table
    await queryRunner.query(`
      CREATE TABLE "customer_addresses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customerId" uuid NOT NULL,
        "street" varchar NOT NULL,
        "city" varchar NOT NULL,
        "state" varchar NOT NULL,
        "zip" varchar NOT NULL,
        "country" varchar NOT NULL,
        "phone" varchar NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_addresses" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_customer_addresses_customerId" ON "customer_addresses" ("customerId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" ADD CONSTRAINT "FK_customer_addresses_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create customer_notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "customer_notification_preferences" (
        "customerId" uuid NOT NULL,
        "orderUpdates" boolean NOT NULL DEFAULT true,
        "promotionalEmails" boolean NOT NULL DEFAULT true,
        "productRecommendations" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customer_notification_preferences" PRIMARY KEY ("customerId")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "customer_notification_preferences" ADD CONSTRAINT "FK_customer_notification_preferences_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create products table
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "description" text NOT NULL,
        "details" text,
        "sellerId" uuid NOT NULL,
        "categoryId" uuid,
        "price" decimal(10,2) NOT NULL,
        "basePrice" decimal(10,2),
        "baseCurrency" varchar(3) DEFAULT 'MKD',
        "stock" integer NOT NULL DEFAULT 0,
        "sku" varchar,
        "images" text,
        "affiliateCommission" decimal(5,2) NOT NULL DEFAULT 0,
        "status" "product_status_enum" NOT NULL DEFAULT 'active',
        "approved" boolean NOT NULL DEFAULT false,
        "rejectionMessage" text,
        "rejectedAt" TIMESTAMP,
        "rating" decimal(3,2),
        "reviewsCount" integer NOT NULL DEFAULT 0,
        "sales" integer NOT NULL DEFAULT 0,
        "hasVariants" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_products_sku" UNIQUE ("sku"),
        CONSTRAINT "PK_products" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_products_sellerId" ON "products" ("sellerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_categoryId" ON "products" ("categoryId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_products_status" ON "products" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_sellerId" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_products_categoryId" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create product_variant_attributes table
    await queryRunner.query(`
      CREATE TABLE "product_variant_attributes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variant_attributes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_product_variant_attributes_productId" ON "product_variant_attributes" ("productId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "FK_product_variant_attributes_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Create product_variant_values table
    await queryRunner.query(`
      CREATE TABLE "product_variant_values" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "attributeId" uuid NOT NULL,
        "value" varchar NOT NULL,
        "colorCode" varchar,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variant_values" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_product_variant_values_attributeId" ON "product_variant_values" ("attributeId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variant_values" ADD CONSTRAINT "FK_product_variant_values_attributeId" FOREIGN KEY ("attributeId") REFERENCES "product_variant_attributes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Create product_variants table
    await queryRunner.query(`
      CREATE TABLE "product_variants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "productId" uuid NOT NULL,
        "combination" jsonb NOT NULL,
        "combinationDisplay" varchar NOT NULL,
        "stock" integer NOT NULL DEFAULT 0,
        "price" decimal(10,2),
        "sku" varchar,
        "images" text,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_product_variants" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_product_variants_productId" ON "product_variants" ("productId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_product_variants_sku" ON "product_variants" ("sku") WHERE "sku" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_variants" ADD CONSTRAINT "FK_product_variants_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Create affiliate_referrals table
    await queryRunner.query(`
      CREATE TABLE "affiliate_referrals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "referralCode" varchar NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "totalClicks" integer NOT NULL DEFAULT 0,
        "totalOrders" integer NOT NULL DEFAULT 0,
        "totalEarnings" decimal(10,2) NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_affiliate_referrals_referralCode" UNIQUE ("referralCode"),
        CONSTRAINT "PK_affiliate_referrals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_referrals_affiliateId" ON "affiliate_referrals" ("affiliateId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_affiliate_referrals_referralCode" ON "affiliate_referrals" ("referralCode")`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "FK_affiliate_referrals_affiliateId" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create affiliate_payment_methods table
    await queryRunner.query(`
      CREATE TABLE "affiliate_payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "bankName" varchar NOT NULL,
        "accountNumber" varchar NOT NULL,
        "accountHolderName" varchar NOT NULL,
        "iban" varchar,
        "swiftCode" varchar,
        "bankAddress" text,
        "verified" boolean NOT NULL DEFAULT false,
        "verificationNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_payment_methods" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_affiliate_payment_methods_affiliateId" ON "affiliate_payment_methods" ("affiliateId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_payment_methods" ADD CONSTRAINT "FK_affiliate_payment_methods_affiliateId" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create payment_method_otps table
    await queryRunner.query(`
      CREATE TABLE "payment_method_otps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "code" varchar NOT NULL,
        "verified" boolean NOT NULL DEFAULT false,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_method_otps" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_method_otps_affiliateId" ON "payment_method_otps" ("affiliateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_method_otps_affiliateId_verified" ON "payment_method_otps" ("affiliateId", "verified")`,
    );

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderNumber" varchar NOT NULL,
        "sellerId" uuid NOT NULL,
        "customerId" uuid NOT NULL,
        "affiliateId" uuid,
        "referralCode" varchar,
        "totalAmount" decimal(10,2) NOT NULL,
        "totalAmountBase" decimal(10,2),
        "buyerCurrency" varchar(3) DEFAULT 'MKD',
        "sellerBaseCurrency" varchar(3) DEFAULT 'MKD',
        "exchangeRate" decimal(10,4) DEFAULT 61.5,
        "status" "order_status_enum" NOT NULL DEFAULT 'pending',
        "trackingId" varchar,
        "statusExplanation" text,
        "shippingAddress" jsonb NOT NULL,
        "paymentMethod" varchar,
        "sellerPaid" boolean NOT NULL DEFAULT false,
        "adminPaid" boolean NOT NULL DEFAULT false,
        "paymentSettledAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_orders_orderNumber" UNIQUE ("orderNumber"),
        CONSTRAINT "PK_orders" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_sellerId" ON "orders" ("sellerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_customerId" ON "orders" ("customerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_affiliateId" ON "orders" ("affiliateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_status" ON "orders" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_createdAt" ON "orders" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_paymentMethod" ON "orders" ("paymentMethod")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_sellerPaid" ON "orders" ("sellerPaid")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_orders_adminPaid" ON "orders" ("adminPaid")`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_sellerId" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_customerId" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_affiliateId" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "productName" varchar NOT NULL,
        "quantity" integer NOT NULL,
        "price" decimal(10,2) NOT NULL,
        "basePrice" decimal(10,2),
        "baseCurrency" varchar(3) DEFAULT 'MKD',
        "variantId" uuid,
        "variantCombination" jsonb,
        CONSTRAINT "PK_order_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_orderId" ON "order_items" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_order_items_productId" ON "order_items" ("productId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD CONSTRAINT "FK_order_items_variantId" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create affiliate_referral_clicks table
    await queryRunner.query(`
      CREATE TABLE "affiliate_referral_clicks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "productId" uuid,
        "referralCode" varchar NOT NULL,
        "clickedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_referral_clicks" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_referral_clicks_affiliateId" ON "affiliate_referral_clicks" ("affiliateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_referral_clicks_productId" ON "affiliate_referral_clicks" ("productId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_referral_clicks_affiliateId_productId" ON "affiliate_referral_clicks" ("affiliateId", "productId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_referral_clicks_referralCode" ON "affiliate_referral_clicks" ("referralCode")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_referral_clicks_clickedAt" ON "affiliate_referral_clicks" ("clickedAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_referral_clicks" ADD CONSTRAINT "FK_affiliate_referral_clicks_affiliateId" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_referral_clicks" ADD CONSTRAINT "FK_affiliate_referral_clicks_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create affiliate_commissions table
    await queryRunner.query(`
      CREATE TABLE "affiliate_commissions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "orderItemAmount" decimal(10,2) NOT NULL,
        "commissionPercent" decimal(5,2) NOT NULL,
        "commissionAmount" decimal(10,2) NOT NULL,
        "status" "commission_status_enum" NOT NULL DEFAULT 'pending',
        "quantity" integer NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_commissions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_commissions_affiliateId" ON "affiliate_commissions" ("affiliateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_commissions_orderId" ON "affiliate_commissions" ("orderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_commissions_status" ON "affiliate_commissions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_commissions_createdAt" ON "affiliate_commissions" ("createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "FK_affiliate_commissions_affiliateId" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "FK_affiliate_commissions_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "FK_affiliate_commissions_productId" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create affiliate_withdrawals table
    await queryRunner.query(`
      CREATE TABLE "affiliate_withdrawals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "affiliateId" uuid NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "status" "withdrawal_status_enum" NOT NULL DEFAULT 'pending',
        "notes" text,
        "paymentMethod" text,
        "paymentDetails" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_affiliate_withdrawals" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_withdrawals_affiliateId" ON "affiliate_withdrawals" ("affiliateId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_withdrawals_status" ON "affiliate_withdrawals" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_affiliate_withdrawals_createdAt" ON "affiliate_withdrawals" ("createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_withdrawals" ADD CONSTRAINT "FK_affiliate_withdrawals_affiliateId" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create notifications table
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "notification_type_enum" NOT NULL,
        "title" varchar NOT NULL,
        "message" text NOT NULL,
        "status" "notification_status_enum" NOT NULL DEFAULT 'unread',
        "metadata" jsonb,
        "link" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "readAt" TIMESTAMP,
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_userId" ON "notifications" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_userId_status" ON "notifications" ("userId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_userId_createdAt" ON "notifications" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create invoices table
    await queryRunner.query(`
      CREATE TABLE "invoices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceNumber" varchar NOT NULL,
        "sellerId" uuid NOT NULL,
        "weekStartDate" date NOT NULL,
        "weekEndDate" date NOT NULL,
        "dueDate" date NOT NULL,
        "status" "invoice_status_enum" NOT NULL DEFAULT 'pending',
        "totalAmount" decimal(10,2) NOT NULL,
        "totalAmountMKD" decimal(10,2),
        "totalAmountEUR" decimal(10,2),
        "orderCount" integer NOT NULL,
        "paidAt" TIMESTAMP,
        "paymentNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_invoices_invoiceNumber" UNIQUE ("invoiceNumber"),
        CONSTRAINT "PK_invoices" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_sellerId" ON "invoices" ("sellerId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_status" ON "invoices" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_weekStartDate" ON "invoices" ("weekStartDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoices_dueDate" ON "invoices" ("dueDate")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoices" ADD CONSTRAINT "FK_invoices_sellerId" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // Create invoice_items table
    await queryRunner.query(`
      CREATE TABLE "invoice_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "invoiceId" uuid NOT NULL,
        "orderId" uuid NOT NULL,
        "orderNumber" varchar NOT NULL,
        "deliveryDate" date NOT NULL,
        "productPrice" decimal(10,2) NOT NULL,
        "productPriceMKD" decimal(10,2),
        "productPriceEUR" decimal(10,2),
        "platformFeePercent" decimal(5,2) NOT NULL,
        "platformFee" decimal(10,2) NOT NULL,
        "platformFeeMKD" decimal(10,2),
        "platformFeeEUR" decimal(10,2),
        "affiliateFeePercent" decimal(5,2),
        "affiliateFee" decimal(10,2) NOT NULL DEFAULT 0,
        "affiliateFeeMKD" decimal(10,2) DEFAULT 0,
        "affiliateFeeEUR" decimal(10,2) DEFAULT 0,
        "totalOwed" decimal(10,2) NOT NULL,
        "totalOwedMKD" decimal(10,2),
        "totalOwedEUR" decimal(10,2),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_invoice_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_items_invoiceId" ON "invoice_items" ("invoiceId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_invoice_items_orderId" ON "invoice_items" ("orderId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_invoice_items_invoiceId" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" ADD CONSTRAINT "FK_invoice_items_orderId" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // ============================================
    // Seed Data
    // ============================================

    // Seed Admin User
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@pazarone.co';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';

    // Check if admin already exists
    const existingAdmin = await queryRunner.manager.query(
      `SELECT id, "userType" FROM users WHERE email = $1`,
      [adminEmail],
    );

    if (existingAdmin.length === 0) {
      // Create new admin user
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await queryRunner.manager.query(
        `INSERT INTO users (id, email, name, password, "userType", "createdAt", "updatedAt") 
         VALUES (uuid_generate_v4(), $1, $2, $3, 'admin', now(), now())`,
        [adminEmail, adminName, hashedPassword],
      );
      console.log(`✅ Super admin user created successfully!`);
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   ⚠️  Please change the password after first login!`);
    } else if (existingAdmin[0].userType !== 'admin') {
      // Update existing user to admin
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await queryRunner.manager.query(
        `UPDATE users SET "userType" = 'admin', password = $1, name = $2, "updatedAt" = now() WHERE email = $3`,
        [hashedPassword, adminName, adminEmail],
      );
      console.log(`✅ Updated user to admin: ${adminEmail}`);
    } else {
      console.log(`✅ Admin user already exists: ${adminEmail}`);
    }

    // Seed Categories
    const existingCategoriesCount = await queryRunner.manager.query(
      `SELECT COUNT(*) as count FROM categories`,
    );

    if (parseInt(existingCategoriesCount[0].count) === 0) {
      const categoryMap = new Map<string, string>();

      // Step 1: Create primary categories
      const primaryCategories = categorySeedData.filter(
        (cat) => cat.type === CategoryType.PRIMARY,
      );

      for (const catData of primaryCategories) {
        const id = await queryRunner.manager.query(
          `INSERT INTO categories (id, name, slug, icon, type, "parentId", translations, "createdAt", "updatedAt") 
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, NULL, $5, now(), now()) 
           RETURNING id, slug`,
          [
            catData.name,
            catData.slug,
            catData.icon,
            catData.type,
            catData.translations ? JSON.stringify(catData.translations) : null,
          ],
        );
        categoryMap.set(id[0].slug, id[0].id);
        console.log(`✓ Created primary category: ${catData.name}`);
      }

      // Step 2: Create secondary categories
      const secondaryCategories = categorySeedData.filter(
        (cat) => cat.type === CategoryType.SECONDARY,
      );

      for (const catData of secondaryCategories) {
        const parentId = catData.parentSlug
          ? categoryMap.get(catData.parentSlug) || null
          : null;

        if (catData.parentSlug && !parentId) {
          console.warn(
            `Parent '${catData.parentSlug}' not found for secondary category '${catData.name}'. Skipping.`,
          );
          continue;
        }

        const id = await queryRunner.manager.query(
          `INSERT INTO categories (id, name, slug, icon, type, "parentId", translations, "createdAt", "updatedAt") 
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now()) 
           RETURNING id, slug`,
          [
            catData.name,
            catData.slug,
            catData.icon,
            catData.type,
            parentId,
            catData.translations ? JSON.stringify(catData.translations) : null,
          ],
        );
        categoryMap.set(id[0].slug, id[0].id);
        console.log(`✓ Created secondary category: ${catData.name}`);
      }

      // Step 3: Create subcategories
      const subcategories = categorySeedData.filter(
        (cat) => cat.type === CategoryType.SUBCATEGORY,
      );

      let subcategoryCount = 0;
      for (const catData of subcategories) {
        if (!catData.parentSlug) {
          console.warn(
            `Subcategory '${catData.name}' missing parentSlug. Skipping.`,
          );
          continue;
        }

        const parentId = categoryMap.get(catData.parentSlug);
        if (!parentId) {
          console.warn(
            `Parent '${catData.parentSlug}' not found for subcategory '${catData.name}'. Skipping.`,
          );
          continue;
        }

        await queryRunner.manager.query(
          `INSERT INTO categories (id, name, slug, icon, type, "parentId", translations, "createdAt", "updatedAt") 
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, now(), now())`,
          [
            catData.name,
            catData.slug,
            catData.icon,
            catData.type,
            parentId,
            catData.translations ? JSON.stringify(catData.translations) : null,
          ],
        );
        subcategoryCount++;
        console.log(`✓ Created subcategory: ${catData.name}`);
      }

      const totalCategories = categoryMap.size + subcategoryCount;
      console.log(
        `✅ Category seeding completed successfully! Created ${totalCategories} categories.`,
      );
    } else {
      console.log(
        `Categories already exist (${existingCategoriesCount[0].count} found). Skipping seed.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_invoice_items_orderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "invoice_items" DROP CONSTRAINT "FK_invoice_items_invoiceId"`,
    );
    await queryRunner.query(`DROP TABLE "invoice_items"`);
    await queryRunner.query(
      `ALTER TABLE "invoices" DROP CONSTRAINT "FK_invoices_sellerId"`,
    );
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(
      `ALTER TABLE "notifications" DROP CONSTRAINT "FK_notifications_userId"`,
    );
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate_withdrawals" DROP CONSTRAINT "FK_affiliate_withdrawals_affiliateId"`,
    );
    await queryRunner.query(`DROP TABLE "affiliate_withdrawals"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate_commissions" DROP CONSTRAINT "FK_affiliate_commissions_productId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_commissions" DROP CONSTRAINT "FK_affiliate_commissions_orderId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_commissions" DROP CONSTRAINT "FK_affiliate_commissions_affiliateId"`,
    );
    await queryRunner.query(`DROP TABLE "affiliate_commissions"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate_referral_clicks" DROP CONSTRAINT "FK_affiliate_referral_clicks_productId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "affiliate_referral_clicks" DROP CONSTRAINT "FK_affiliate_referral_clicks_affiliateId"`,
    );
    await queryRunner.query(`DROP TABLE "affiliate_referral_clicks"`);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_variantId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_productId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP CONSTRAINT "FK_order_items_orderId"`,
    );
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_affiliateId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_customerId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_sellerId"`,
    );
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "payment_method_otps"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate_payment_methods" DROP CONSTRAINT "FK_affiliate_payment_methods_affiliateId"`,
    );
    await queryRunner.query(`DROP TABLE "affiliate_payment_methods"`);
    await queryRunner.query(
      `ALTER TABLE "affiliate_referrals" DROP CONSTRAINT "FK_affiliate_referrals_affiliateId"`,
    );
    await queryRunner.query(`DROP TABLE "affiliate_referrals"`);
    await queryRunner.query(
      `ALTER TABLE "product_variants" DROP CONSTRAINT "FK_product_variants_productId"`,
    );
    await queryRunner.query(`DROP TABLE "product_variants"`);
    await queryRunner.query(
      `ALTER TABLE "product_variant_values" DROP CONSTRAINT "FK_product_variant_values_attributeId"`,
    );
    await queryRunner.query(`DROP TABLE "product_variant_values"`);
    await queryRunner.query(
      `ALTER TABLE "product_variant_attributes" DROP CONSTRAINT "FK_product_variant_attributes_productId"`,
    );
    await queryRunner.query(`DROP TABLE "product_variant_attributes"`);
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_products_categoryId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" DROP CONSTRAINT "FK_products_sellerId"`,
    );
    await queryRunner.query(`DROP TABLE "products"`);
    await queryRunner.query(
      `ALTER TABLE "customer_notification_preferences" DROP CONSTRAINT "FK_customer_notification_preferences_customerId"`,
    );
    await queryRunner.query(`DROP TABLE "customer_notification_preferences"`);
    await queryRunner.query(
      `ALTER TABLE "customer_addresses" DROP CONSTRAINT "FK_customer_addresses_customerId"`,
    );
    await queryRunner.query(`DROP TABLE "customer_addresses"`);
    await queryRunner.query(
      `ALTER TABLE "seller_settings" DROP CONSTRAINT "FK_seller_settings_sellerId"`,
    );
    await queryRunner.query(`DROP TABLE "seller_settings"`);
    await queryRunner.query(
      `ALTER TABLE "password_resets" DROP CONSTRAINT "FK_password_resets_userId"`,
    );
    await queryRunner.query(`DROP TABLE "password_resets"`);
    await queryRunner.query(`DROP TABLE "email_verifications"`);
    await queryRunner.query(`DROP TABLE "platform_settings"`);
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_parentId"`,
    );
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "invoice_status_enum"`);
    await queryRunner.query(`DROP TYPE "notification_status_enum"`);
    await queryRunner.query(`DROP TYPE "notification_type_enum"`);
    await queryRunner.query(`DROP TYPE "withdrawal_status_enum"`);
    await queryRunner.query(`DROP TYPE "commission_status_enum"`);
    await queryRunner.query(`DROP TYPE "order_status_enum"`);
    await queryRunner.query(`DROP TYPE "product_status_enum"`);
    await queryRunner.query(`DROP TYPE "category_type_enum"`);
    await queryRunner.query(`DROP TYPE "user_type_enum"`);
  }
}
