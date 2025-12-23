import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminProductsService } from './admin-products.service';
import { AdminQueryDto } from './dto/admin-query.dto';
import { RejectProductDto } from './dto/reject-product.dto';
import { ProductStatus } from '../products/entities/product.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';

@ApiTags('admin-products')
@ApiBearerAuth('JWT-auth')
@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all products',
    description: 'Returns paginated list of all products across all sellers (admin only)',
  })
  @ApiQuery({ name: 'status', required: false, enum: ProductStatus, description: 'Filter by product status' })
  @ApiQuery({ name: 'sellerId', required: false, type: String, description: 'Filter by seller ID' })
  @ApiQuery({ name: 'approved', required: false, type: Boolean, description: 'Filter by approval status (true/false)' })
  @ApiResponse({ status: 200, description: 'Products retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  findAll(
    @Query()
    query: AdminQueryDto & {
      status?: ProductStatus;
      sellerId?: string;
      approved?: boolean;
    },
  ) {
    return this.adminProductsService.findAll(query);
  }

  @Put(':id/approve')
  @ApiOperation({
    summary: 'Approve a product',
    description: 'Approve a product to make it visible publicly (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product approved successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Product already approved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  approveProduct(@Param('id') id: string) {
    return this.adminProductsService.approveProduct(id);
  }

  @Put(':id/reject')
  @ApiOperation({
    summary: 'Reject a product',
    description: 'Reject a product to hide it from public view (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: RejectProductDto })
  @ApiResponse({ status: 200, description: 'Product rejected successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 400, description: 'Product already rejected' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  rejectProduct(
    @Param('id') id: string,
    @Body() rejectProductDto: RejectProductDto,
  ) {
    return this.adminProductsService.rejectProduct(id, rejectProductDto.message);
  }

  @Get('statistics')
  @ApiOperation({
    summary: 'Get product statistics',
    description: 'Returns platform-wide product statistics (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  getStatistics() {
    return this.adminProductsService.getStatistics();
  }
}

