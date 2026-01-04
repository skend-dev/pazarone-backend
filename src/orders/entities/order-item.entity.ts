import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order } from './order.entity';
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('order_items')
@Index(['orderId'])
@Index(['productId'])
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  productName: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number; // Price in buyer currency (charged price)

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  basePrice: number | null; // Base price in seller's currency (for order consistency)

  @Column({ type: 'varchar', length: 3, nullable: true, default: 'MKD' })
  baseCurrency: string | null; // Base currency ('MKD' or 'EUR')

  @Column('uuid', { nullable: true })
  variantId: string | null; // Selected product variant ID

  @ManyToOne(() => ProductVariant, { nullable: true })
  @JoinColumn({ name: 'variantId' })
  variant: ProductVariant | null;

  @Column('jsonb', { nullable: true })
  variantCombination: Record<string, string> | null; // Store variant combination for order history (e.g., { "Size": "XL", "Color": "Red" })
}

