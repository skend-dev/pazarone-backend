import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { PublicProductQueryDto } from './dto/public-product-query.dto';

@ApiTags('products')
@Controller('products')
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all products from all stores (public)',
    description:
      'Returns a paginated list of active products from all sellers. No authentication required.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search term (searches in product name)',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    type: String,
    description: 'Category ID (UUID) to filter products',
  })
  @ApiQuery({
    name: 'sellerId',
    required: false,
    type: String,
    description: 'Seller ID (UUID) to filter products by seller',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      'newest',
      'oldest',
      'price_asc',
      'price_desc',
      'name_asc',
      'name_desc',
    ],
    description: 'Sort order (default: newest)',
  })
  @ApiResponse({
    status: 200,
    description: 'Products retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'number' },
              stock: { type: 'number' },
              sellerId: {
                type: 'string',
                format: 'uuid',
                description: 'Seller ID',
              },
              images: { type: 'array', items: { type: 'string' } },
              status: {
                type: 'string',
                enum: ['active', 'out_of_stock', 'inactive'],
              },
              category: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  slug: { type: 'string' },
                  icon: { type: 'string' },
                },
              },
              seller: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  email: { type: 'string' },
                  storeName: {
                    type: 'string',
                    nullable: true,
                    description: 'Store name from seller settings',
                  },
                  storeLogo: {
                    type: 'string',
                    nullable: true,
                    description: 'Store logo URL from seller settings',
                  },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAll(@Query() query: PublicProductQueryDto) {
    return this.productsService.findAllPublic(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single product by ID (public)',
    description:
      'Returns product details including category and seller information. No authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Product ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Product retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        name: { type: 'string' },
        description: { type: 'string' },
        details: { type: 'string', nullable: true },
        price: { type: 'number' },
        stock: { type: 'number' },
        sellerId: { type: 'string', format: 'uuid', description: 'Seller ID' },
        sku: { type: 'string', nullable: true },
        images: { type: 'array', items: { type: 'string' } },
        status: {
          type: 'string',
          enum: ['active', 'out_of_stock', 'inactive'],
        },
        rating: { type: 'number', nullable: true },
        reviewsCount: { type: 'number' },
        sales: { type: 'number' },
        affiliateCommission: { type: 'number' },
        category: {
          type: 'object',
          nullable: true,
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            icon: { type: 'string' },
            type: {
              type: 'string',
              enum: ['primary', 'secondary', 'subcategory'],
            },
          },
        },
        seller: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOnePublic(id);
  }
}
