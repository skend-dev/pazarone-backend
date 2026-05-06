import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { ListInfobipActivityQueryDto } from './dto/list-infobip-activity-query.dto';
import { MarketingInfobipWebhookService } from './marketing-infobip-webhook.service';

@ApiTags('admin-marketing')
@ApiBearerAuth('JWT-auth')
@Controller('admin/marketing/infobip-activity')
@UseGuards(JwtAuthGuard, AdminAuthGuard)
export class AdminInfobipActivityController {
  constructor(
    private readonly marketingInfobipWebhookService: MarketingInfobipWebhookService,
  ) {}

  @Get('delivery')
  @ApiOperation({
    summary: 'Paginated delivery / status events from Infobip webhooks',
  })
  async listDelivery(@Query() query: ListInfobipActivityQueryDto) {
    return this.marketingInfobipWebhookService.listDeliveryEvents(query);
  }

  @Get('inbound')
  @ApiOperation({
    summary: 'Paginated inbound replies from Infobip webhooks',
  })
  async listInbound(@Query() query: ListInfobipActivityQueryDto) {
    return this.marketingInfobipWebhookService.listInboundMessages(query);
  }
}
