import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoiceSchedulerService {
  private readonly logger = new Logger(InvoiceSchedulerService.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Generate weekly invoices every Monday at 00:00
   */
  @Cron('0 0 * * 1') // Every Monday at 00:00
  async handleWeeklyInvoiceGeneration() {
    this.logger.log('Running scheduled weekly invoice generation...');
    try {
      await this.invoiceService.generateWeeklyInvoices();
      this.logger.log('Weekly invoice generation completed successfully');
    } catch (error) {
      this.logger.error('Error in weekly invoice generation:', error);
    }
  }

  /**
   * Update overdue invoices daily at 01:00
   */
  @Cron('0 1 * * *') // Daily at 01:00
  async handleOverdueInvoiceUpdate() {
    this.logger.log('Running scheduled overdue invoice update...');
    try {
      await this.invoiceService.updateOverdueInvoices();
      this.logger.log('Overdue invoice update completed successfully');
    } catch (error) {
      this.logger.error('Error in overdue invoice update:', error);
    }
  }
}
