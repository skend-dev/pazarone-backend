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
import { Product } from './product.entity';
import { ProductVariantValue } from './product-variant-value.entity';

/**
 * Product Variant Attribute (e.g., Size, Color, Material)
 * Defines what type of variant a product can have
 */
@Entity('product_variant_attributes')
@Index(['productId'])
export class ProductVariantAttribute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @ManyToOne(() => Product, (product) => product.variantAttributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @Column()
  name: string; // e.g., "Size", "Color", "Material"

  @Column('int', { default: 0 })
  displayOrder: number; // Order in which to display this attribute

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(
    () => ProductVariantValue,
    (variantValue) => variantValue.attribute,
    { cascade: true },
  )
  values: ProductVariantValue[];
}
