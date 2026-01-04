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
import { ProductVariantAttribute } from './product-variant-attribute.entity';

/**
 * Product Variant Value (e.g., "XL", "Red", "Cotton")
 * The actual values for each variant attribute
 */
@Entity('product_variant_values')
@Index(['attributeId'])
export class ProductVariantValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  attributeId: string;

  @ManyToOne(
    () => ProductVariantAttribute,
    (attribute) => attribute.values,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'attributeId' })
  attribute: ProductVariantAttribute;

  @Column()
  value: string; // e.g., "XL", "Red", "Cotton"

  @Column('varchar', { nullable: true })
  colorCode: string | null; // Hex color code for color attributes (e.g., "#FF0000")

  @Column('int', { default: 0 })
  displayOrder: number; // Order in which to display this value

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

