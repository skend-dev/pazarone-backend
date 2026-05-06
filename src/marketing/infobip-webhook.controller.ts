import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { MarketingInfobipWebhookService } from './marketing-infobip-webhook.service';

/**
 * Public URLs for Infobip portal webhook configuration (no JWT).
 * When `INFOBIP_WEBHOOK_SECRET` is set, send one of:
 * - `Authorization: Bearer <secret>`
 * - Header `X-Infobip-Webhook-Secret: <secret>`
 * - Query `?token=<secret>` (Viber BM / Infobip UI often uses this)
 * @see https://www.infobip.com/docs/essentials/webhooks
 */
@ApiTags('webhooks-infobip')
@SkipThrottle()
@Controller('webhooks/infobip')
@UsePipes(
  new ValidationPipe({
    whitelist: false,
    forbidNonWhitelisted: false,
    transform: false,
  }),
)
export class InfobipWebhookController {
  constructor(
    private readonly marketingInfobipWebhookService: MarketingInfobipWebhookService,
  ) {}

  private assertWebhook(
    authorization: string | undefined,
    secretHeader: string | undefined,
    token: string | undefined,
  ): void {
    this.marketingInfobipWebhookService.assertWebhookAuthorized(
      authorization,
      secretHeader,
      token,
    );
  }

  @Post('viber/delivery')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Viber DLR — delivery report webhook',
    description:
      'Use in Infobip “DLR forwarding” as POST URL, e.g. …/viber/delivery?token=<INFOBIP_WEBHOOK_SECRET>',
  })
  async viberDelivery(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-infobip-webhook-secret') secretHeader: string | undefined,
    @Query('token') token: string | undefined,
    @Body() body: unknown,
  ) {
    this.assertWebhook(authorization, secretHeader, token);
    return this.marketingInfobipWebhookService.ingestDeliveryReports(body);
  }

  @Post('viber/incoming')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Viber MO — incoming message webhook',
    description:
      'Use in Infobip “Forward to HTTP” for inbound as POST …/viber/incoming?token=<INFOBIP_WEBHOOK_SECRET>',
  })
  async viberIncoming(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-infobip-webhook-secret') secretHeader: string | undefined,
    @Query('token') token: string | undefined,
    @Body() body: unknown,
  ) {
    this.assertWebhook(authorization, secretHeader, token);
    return this.marketingInfobipWebhookService.ingestInboundMessages(body);
  }

  @Post('delivery-reports')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Infobip outbound delivery / DR webhook (legacy path)',
  })
  async deliveryReports(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-infobip-webhook-secret') secretHeader: string | undefined,
    @Query('token') token: string | undefined,
    @Body() body: unknown,
  ) {
    this.assertWebhook(authorization, secretHeader, token);
    return this.marketingInfobipWebhookService.ingestDeliveryReports(body);
  }

  @Post('inbound')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Infobip inbound message webhook (legacy path)',
  })
  async inbound(
    @Headers('authorization') authorization: string | undefined,
    @Headers('x-infobip-webhook-secret') secretHeader: string | undefined,
    @Query('token') token: string | undefined,
    @Body() body: unknown,
  ) {
    this.assertWebhook(authorization, secretHeader, token);
    return this.marketingInfobipWebhookService.ingestInboundMessages(body);
  }
}
