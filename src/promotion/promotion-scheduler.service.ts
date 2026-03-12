import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PromotionEmailService } from './promotion-email.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';

/** PostgreSQL advisory lock ID for promotion emails (prevents duplicate runs across multiple backend instances) */
const PROMOTION_LOCK_ID = 0x50524f4d; // 'PROM' in hex

@Injectable()
export class PromotionSchedulerService {
  private readonly logger = new Logger(PromotionSchedulerService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly promotionEmailService: PromotionEmailService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  /**
   * Runs daily at 9:00 AM (Europe/Skopje). Only sends emails if schedule matches:
   * - daily: always runs
   * - weekly: runs only on the configured day of week (0=Sun, 1=Mon, ..., 6=Sat)
   * Uses PostgreSQL advisory lock so only one instance runs when multiple replicas are deployed.
   */
  @Cron('0 9 * * *', {
    name: 'promotion-emails',
    timeZone: 'Europe/Skopje',
  })
  async handleScheduledPromotionEmails() {
    this.logger.log('Running scheduled promotion emails...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // Distributed lock: only one backend instance can run this job
      const lockResult = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) as acquired',
        [PROMOTION_LOCK_ID],
      );
      const acquired = lockResult?.[0]?.acquired === true;
      if (!acquired) {
        this.logger.log(
          'Promotion emails skipped: another instance is already running this job',
        );
        return;
      }

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
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [
          PROMOTION_LOCK_ID,
        ]);
      }
    } catch (error) {
      this.logger.error('Error in scheduled promotion emails:', error);
    } finally {
      await queryRunner.release();
    }
  }
}
