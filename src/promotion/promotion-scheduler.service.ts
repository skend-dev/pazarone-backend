import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PromotionEmailService } from './promotion-email.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';

@Injectable()
export class PromotionSchedulerService {
  private readonly logger = new Logger(PromotionSchedulerService.name);

  constructor(
    private readonly promotionEmailService: PromotionEmailService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /**
   * Runs daily at 9:00 AM (Europe/Skopje). Only sends emails if schedule matches:
   * - daily: always runs
   * - weekly: runs only on the configured day of week (0=Sun, 1=Mon, ..., 6=Sat)
   */
  @Cron('0 9 * * *', {
    name: 'promotion-emails',
    timeZone: 'Europe/Skopje',
  })
  async handleScheduledPromotionEmails() {
    this.logger.log('Running scheduled promotion emails...');
    try {
      const { schedule, dayOfWeek } =
        await this.platformSettingsService.getPromotionEmailSchedule();

      const now = new Date();
      const today = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday

      if (schedule === 'weekly' && today !== dayOfWeek) {
        this.logger.log(
          `Promotion emails skipped: weekly schedule (runs on day ${dayOfWeek}, today is ${today})`,
        );
        return;
      }

      const result =
        await this.promotionEmailService.runScheduledPromotionEmails();

      if (result.flashDeals.skipped) {
        this.logger.log(
          `Flash deal emails skipped: ${result.flashDeals.reason ?? 'unknown'}`,
        );
      } else {
        this.logger.log(
          `Flash deal emails completed: ${result.flashDeals.sent} emails sent`,
        );
      }

      if (result.newArrivals.skipped) {
        this.logger.log(
          `New arrival emails skipped: ${result.newArrivals.reason ?? 'unknown'}`,
        );
      } else {
        this.logger.log(
          `New arrival emails completed: ${result.newArrivals.sent} emails sent`,
        );
      }
    } catch (error) {
      this.logger.error('Error in scheduled promotion emails:', error);
    }
  }
}
