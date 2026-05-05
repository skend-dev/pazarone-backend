import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AdminBroadcastService } from './admin-broadcast.service';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';

@ApiTags('admin-broadcast')
@ApiBearerAuth('JWT-auth')
@Controller('admin/broadcast')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminBroadcastController {
  constructor(private readonly adminBroadcastService: AdminBroadcastService) {}

  @Get()
  @ApiOperation({
    summary: 'List sent broadcasts',
    description:
      'Returns paginated list of sent broadcasts with createdBy for history and duplicate support. Admin only.',
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
    name: 'isAutomated',
    required: false,
    type: Boolean,
    description: 'Filter by automated broadcasts only (true) or manual only (false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Broadcasts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        broadcasts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              message: { type: 'string' },
              broadcastType: {
                type: 'string',
                enum: ['promote_products_affiliates', 'general_announcement', 'marketing_products_customers'],
              },
              targetAudience: { type: 'array', items: { type: 'string' } },
              deliveryMethod: { type: 'string' },
              featuredProductIds: {
                type: 'array',
                items: { type: 'string' },
                nullable: true,
              },
              emailSent: { type: 'number' },
              notificationsCreated: { type: 'number' },
              createdAt: { type: 'string', format: 'date-time' },
              createdBy: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  email: { type: 'string' },
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
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  listBroadcasts(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('isAutomated') isAutomated?: string,
  ) {
    const pageNum = page ? parseInt(String(page), 10) : 1;
    const limitNum = limit ? parseInt(String(limit), 10) : 20;
    const isAutomatedFilter =
      isAutomated === 'true' ? true : isAutomated === 'false' ? false : undefined;
    return this.adminBroadcastService.findAll(
      pageNum,
      limitNum,
      isAutomatedFilter,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Send broadcast announcement',
    description:
      'Send marketing/news announcement to affiliates, sellers, and/or customers via email and/or in-app notification. Stored for history and duplicate. Admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Broadcast sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        emailSent: { type: 'number', example: 150 },
        notificationsCreated: { type: 'number', example: 150 },
        message: { type: 'string', example: 'Broadcast sent successfully' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  sendBroadcast(
    @Body() dto: CreateBroadcastDto,
    @CurrentUser() user: User,
  ) {
    return this.adminBroadcastService.broadcast(dto, user.id);
  }

  @Get('audience-counts')
  @ApiOperation({
    summary: 'Get audience counts',
    description:
      'Returns counts of affiliates, sellers, customers, and marketing contacts with email (Audience list) for the broadcast selector. Optional gender narrows customer and Audience-list counts to that gender on file. Admin only.',
  })
  @ApiQuery({
    name: 'gender',
    required: false,
    description:
      'Match against marketing_contacts.gender (customers via linked profile; Audience list rows). Case-insensitive.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audience counts retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        affiliates: { type: 'number', example: 42 },
        sellers: { type: 'number', example: 28 },
        customers: { type: 'number', example: 1250 },
        marketingAudienceWithEmail: { type: 'number', example: 320 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin access required' })
  getAudienceCounts(@Query('gender') gender?: string) {
    const g = gender?.trim();
    return this.adminBroadcastService.getAudienceCounts(g || undefined);
  }

  @Get(':id/progress')
  @ApiOperation({
    summary: 'Get broadcast job progress',
    description:
      'Returns live sending progress for a broadcast job. While status is "processing" the counters update in real-time; poll every 2–3 s. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Progress retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', enum: ['processing', 'done', 'failed'] },
        emailSent: { type: 'number' },
        notificationsCreated: { type: 'number' },
        emailFailed: { type: 'number' },
        totalRecipients: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Broadcast not found' })
  getBroadcastProgress(@Param('id') id: string) {
    return this.adminBroadcastService.getProgress(id);
  }
}
