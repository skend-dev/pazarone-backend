import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateImagesDto } from './dto/update-images.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('seller-products')
@ApiBearerAuth('JWT-auth')
@Controller('seller/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(
    @CurrentUser() user: User,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(user.id, createProductDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all products for the seller' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: User, @Query() query: ProductQueryDto) {
    return this.productsService.findAll(user.id, query, user.userType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.productsService.findOne(id, user.id, user.userType);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(
      id,
      user.id,
      updateProductDto,
      user.userType,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.productsService.remove(id, user.id, user.userType);
  }

  @Post(':id/images')
  @ApiOperation({ summary: 'Update product images' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Images updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid number of images',
  })
  @ApiResponse({ status: 404, description: 'Product not found' })
  updateImages(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateImagesDto: UpdateImagesDto,
  ) {
    return this.productsService.updateImages(
      id,
      user.id,
      updateImagesDto.images,
      user.userType,
    );
  }
}
