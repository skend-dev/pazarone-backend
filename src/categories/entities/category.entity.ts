import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';

export enum CategoryType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  SUBCATEGORY = 'subcategory',
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  @Index()
  slug: string;

  @Column()
  icon: string;

  @Column({
    type: 'enum',
    enum: CategoryType,
    default: CategoryType.PRIMARY,
  })
  type: CategoryType;

  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Category, (category) => category.subcategories, {
    nullable: true,
  })
  @JoinColumn({ name: 'parentId' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  subcategories: Category[];

  @OneToMany(() => Product, (product) => product.category)
  products: Product[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
