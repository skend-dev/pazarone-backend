import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
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
import { BulkAdminProductsDto } from './dto/bulk-admin-products.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { ProductStatus } from '../products/entities/product.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

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

  @Post('bulk')
  @ApiOperation({
    summary: 'Bulk update products',
    description:
      'Approve, reject, activate, or deactivate up to 100 products at once (admin only)',
  })
  @ApiBody({ type: BulkAdminProductsDto })
  @ApiResponse({ status: 200, description: 'Bulk action completed' })
  bulkAction(@Body() dto: BulkAdminProductsDto) {
    return this.adminProductsService.bulkAction(dto);
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

  @Put(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate a product',
    description: 'Toggle product active/inactive status (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductStatusDto })
  @ApiResponse({ status: 200, description: 'Product status updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateProductStatusDto: UpdateProductStatusDto,
  ) {
    return this.adminProductsService.updateStatus(
      id,
      updateProductStatusDto.active,
    );
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a product',
    description: 'Update any product (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.adminProductsService.update(id, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a product',
    description:
      'Permanently deletes a product with no order history, or deactivates it when orders exist (admin only)',
  })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted or deactivated' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  remove(@Param('id') id: string) {
    return this.adminProductsService.remove(id);
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

