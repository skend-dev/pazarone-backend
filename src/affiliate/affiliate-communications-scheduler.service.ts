import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AffiliateCommunicationsService } from './affiliate-communications.service';

@Injectable()
export class AffiliateCommunicationsSchedulerService {
  private readonly logger = new Logger(
    AffiliateCommunicationsSchedulerService.name,
  );

  constructor(
    private readonly affiliateCommunicationsService: AffiliateCommunicationsService,
  ) {}

  /**
   * Send weekly affiliate communications every Monday at 9:00 AM
   * Cron expression: '0 9 * * 1' means: minute 0, hour 9, any day of month, any month, Monday (1)
   */
  @Cron('0 9 * * 1', {
    name: 'weekly-affiliate-communications',
    timeZone: 'Europe/Skopje', // Adjust timezone as needed
  })
  async handleWeeklyAffiliateCommunications() {
    this.logger.log(
      'Running scheduled weekly affiliate communications...',
    );
    try {
      await this.affiliateCommunicationsService.sendWeeklyCommunications();
      this.logger.log(
        'Weekly affiliate communications completed successfully',
      );
    } catch (error) {
      this.logger.error(
        'Error in weekly affiliate communications:',
        error,
      );
    }
  }
}
