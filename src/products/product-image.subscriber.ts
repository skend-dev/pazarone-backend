import { EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { rewriteProductImageUrls } from './product-image-url.util';

@EventSubscriber()
export class ProductImageSubscriber implements EntitySubscriberInterface<Product> {
  listenTo() {
    return Product;
  }

  afterLoad(entity: Product) {
    entity.images = rewriteProductImageUrls(entity.images);
  }
}

@EventSubscriber()
export class ProductVariantImageSubscriber
  implements EntitySubscriberInterface<ProductVariant>
{
  listenTo() {
    return ProductVariant;
  }

  afterLoad(entity: ProductVariant) {
    entity.images = rewriteProductImageUrls(entity.images);
  }
}
