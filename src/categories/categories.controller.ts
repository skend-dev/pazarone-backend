import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
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

  @Get(':id')
  @ApiOperation({ summary: 'Get single category with subcategories' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(@Param('id') id: string) {
    return this.categoriesService.findOne(id);
  }
}
