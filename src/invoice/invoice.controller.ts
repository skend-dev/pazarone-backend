import {
  Controller,
  Get,
  Put,
  Post,
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
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { InvoiceService } from './invoice.service';
import { InvoiceStatus } from './entities/invoice.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { SellerAuthGuard } from '../auth/guards/seller-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

class MarkInvoicePaidDto {
  @ApiPropertyOptional({
    description: 'Optional payment notes or description',
    example: 'Payment processed via bank transfer on 2025-01-01',
  })
  @IsOptional()
  @IsString()
  paymentNotes?: string;
}

@ApiTags('invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('seller/my-invoices')
  @UseGuards(JwtAuthGuard, SellerAuthGuard)
  @ApiOperation({
    summary: 'Get seller invoices',
    description:
      'Returns paginated list of invoices for the authenticated seller',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiResponse({
    status: 200,
    description: 'Invoices retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyInvoices(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoiceService.getSellerInvoices(
      user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
    );
  }

  @Get('seller/:invoiceId')
  @UseGuards(JwtAuthGuard, SellerAuthGuard)
  @ApiOperation({
    summary: 'Get invoice by ID',
    description: 'Returns invoice details for the authenticated seller',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getInvoiceById(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: User,
  ) {
    return this.invoiceService.getInvoiceById(invoiceId, user.id);
  }

  // Seller endpoint for marking invoices as paid is disabled
  // Only admins can mark invoices as paid via PUT /api/invoices/admin/:invoiceId/mark-paid

  @Get('admin/seller/:sellerId')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Get invoices for a seller (admin)',
    description:
      'Returns paginated list of invoices for a specific seller (admin only)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiResponse({
    status: 200,
    description: 'Invoices retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getSellerInvoices(
    @Param('sellerId') sellerId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoiceService.getSellerInvoices(
      sellerId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
    );
  }

  @Get('admin/:invoiceId')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Get invoice by ID (admin)',
    description: 'Returns invoice details (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  getInvoiceByIdAdmin(@Param('invoiceId') invoiceId: string) {
    return this.invoiceService.getInvoiceById(invoiceId);
  }

  @Put('admin/:invoiceId/mark-paid')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Mark invoice as paid (admin)',
    description: 'Marks an invoice as paid by admin (admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked as paid successfully',
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 400, description: 'Invoice already paid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  markInvoiceAsPaidByAdmin(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: MarkInvoicePaidDto,
  ) {
    return this.invoiceService.markInvoiceAsPaidByAdmin(
      invoiceId,
      dto.paymentNotes,
    );
  }

  @Post('admin/generate-for-seller/:sellerId')
  @UseGuards(JwtAuthGuard, AdminAuthGuard)
  @ApiOperation({
    summary: 'Generate invoice for a specific seller (admin)',
    description:
      'Manually generates an invoice for a specific seller with all delivered COD orders that are not yet paid/invoiced. Admin only.',
  })
  @ApiParam({
    name: 'sellerId',
    description: 'Seller ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Invoice generated successfully',
  })
  @ApiResponse({ status: 404, description: 'Seller not found' })
  @ApiResponse({
    status: 400,
    description: 'No orders found or invoice already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - admin access required',
  })
  async generateInvoiceForSeller(
    @Param('sellerId') sellerId: string,
  ) {
    return this.invoiceService.generateInvoiceForSpecificSeller(sellerId);
  }
}
