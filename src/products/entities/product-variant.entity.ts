import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * Product Variant
 * Represents a specific combination of variant values (e.g., Size: XL, Color: Red)
 * Each variant has its own stock, price (optional), SKU, and images
 */
@Entity('product_variants')
@Index(['productId'])
@Index(['sku'], { unique: true, where: '"sku" IS NOT NULL' })
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  /**
   * Variant combination stored as JSON
   * Format: { "Size": "XL", "Color": "Red" }
   * This allows flexible variant combinations
   */
  @Column('jsonb')
  combination: Record<string, string>; // e.g., { "Size": "XL", "Color": "Red" }

  /**
   * Variant combination as a string for display/search
   * Format: "Size: XL, Color: Red"
   */
  @Column()
  combinationDisplay: string; // Human-readable format

  @Column('int', { default: 0 })
  stock: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price: number | null; // Optional: if null, use product base price

  @Column({ type: 'varchar', unique: true, nullable: true })
  sku: string | null; // Optional: variant-specific SKU

  @Column('simple-array', { nullable: true })
  images: string[] | null; // Optional: variant-specific images

  @Column('boolean', { default: true })
  isActive: boolean; // Whether this variant is available for purchase

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

