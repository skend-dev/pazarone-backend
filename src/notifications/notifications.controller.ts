import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { MarkReadDto } from './dto/mark-read.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@CurrentUser() user: User, @Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll(user.id, query, user.userType);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUnreadCount(@CurrentUser() user: User) {
    const count = await this.notificationsService.getUnreadCount(user.id);
    return { unreadCount: count };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single notification by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.findOne(id, user.id, user.userType);
  }

  @Put('mark-read')
  @ApiOperation({ summary: 'Mark notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'Notifications marked as read successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  markAsRead(@CurrentUser() user: User, @Body() markReadDto: MarkReadDto) {
    return this.notificationsService.markAsRead(
      markReadDto.notificationIds,
      user.id,
      user.userType,
    );
  }

  @Put('mark-all-read')
  @ApiOperation({
    summary: 'Mark all notifications as read for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  markAllAsRead(@CurrentUser() user: User) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.notificationsService.remove(id, user.id, user.userType);
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Delete multiple notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications deleted successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  removeMany(
    @CurrentUser() user: User,
    @Body() body: { notificationIds: string[] },
  ) {
    return this.notificationsService.removeMany(
      body.notificationIds,
      user.id,
      user.userType,
    );
  }
}
