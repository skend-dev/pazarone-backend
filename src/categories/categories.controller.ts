import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({
    summary:
      'Get all categories with primary/secondary distinction and subcategories',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories retrieved successfully',
  })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('flat')
  @ApiOperation({
    summary: 'Get all categories flattened (useful for dropdowns/selects)',
  })
  @ApiResponse({
    status: 200,
    description: 'Flat categories list retrieved successfully',
  })
  findAllFlat() {
    return this.categoriesService.findAllFlat();
  }

  @Get('popular')
  @ApiOperation({
    summary: 'Get popular categories with product counts (for landing/marketplace)',
    description:
      'Returns categories ordered by product count (active, approved). Used by landing page and category quick entry.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of categories to return (default: 10)',
  })
  @ApiResponse({
    status: 200,
    description: 'Popular categories with productsCount',
    schema: {
      type: 'object',
      properties: {
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string' },
              slug: { type: 'string' },
              icon: { type: 'string' },
              type: { type: 'string' },
              parentId: { type: 'string', nullable: true },
              productsCount: { type: 'number' },
            },
          },
        },
      },
    },
  })
  findPopular(@Query('limit') limit?: number) {
    return this.categoriesService.findPopular(
      limit ? parseInt(limit.toString(), 10) : 10,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single category with subcategories' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }
}
