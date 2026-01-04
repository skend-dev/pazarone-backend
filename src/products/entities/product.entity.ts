import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { ProductVariantAttribute } from './product-variant-attribute.entity';
import { ProductVariant } from './product-variant.entity';

export enum ProductStatus {
  ACTIVE = 'active',
  OUT_OF_STOCK = 'out_of_stock',
  INACTIVE = 'inactive',
}

@Entity('products')
@Index(['sellerId'])
@Index(['categoryId'])
@Index(['status'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  details: string | null;

  @Column('uuid')
  sellerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column('uuid', { nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: Category | null;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // Legacy field - kept for backward compatibility

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  basePrice: number | null; // Base price in seller's market currency

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'MKD' })
  baseCurrency: string | null; // 'MKD' or 'EUR' - determined by seller's market

  @Column('int', { default: 0 })
  stock: number;

  @Column({ type: 'varchar', unique: true, nullable: true })
  sku: string | null;

  @Column('simple-array', { nullable: true })
  images: string[];

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  affiliateCommission: number;

  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  @Column({ default: false })
  approved: boolean; // Product approval status (auto-approved for verified sellers)

  @Column('text', { nullable: true })
  rejectionMessage: string | null; // Rejection reason from admin

  @Column({ type: 'timestamp', nullable: true })
  rejectedAt: Date | null; // When the product was rejected

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  rating: number | null;

  @Column('int', { default: 0 })
  reviewsCount: number;

  @Column('int', { default: 0 })
  sales: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @OneToMany(
    () => ProductVariantAttribute,
    (attribute) => attribute.product,
    { cascade: true },
  )
  variantAttributes: ProductVariantAttribute[];

  @OneToMany(() => ProductVariant, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariant[];

  @Column({ default: false })
  hasVariants: boolean; // Whether this product has variants
}
