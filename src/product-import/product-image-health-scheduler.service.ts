import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ProductImageHealthService } from './product-image-health.service';

const IMAGE_HEALTH_LOCK_ID = 0x494d4748; // 'IMGH'

@Injectable()
export class ProductImageHealthSchedulerService {
  private readonly logger = new Logger(ProductImageHealthSchedulerService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly productImageHealthService: ProductImageHealthService,
  ) {}

  @Cron('0 3 * * *', {
    name: 'external-product-image-health',
    timeZone: 'Europe/Skopje',
  })
  async handleDailyImageHealthCheck() {
    this.logger.log('Running external product image health check...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const lockResult = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1) as acquired',
        [IMAGE_HEALTH_LOCK_ID],
      );
      const acquired = lockResult?.[0]?.acquired === true;
      if (!acquired) {
        this.logger.log('Image health check skipped: lock held by another instance');
        return;
      }

      try {
        const result =
          await this.productImageHealthService.checkAllExternalProducts();
        this.logger.log(
          `Image health check done: ${result.checked} checked, ${result.newlyBroken} newly broken, ${result.healed} healed`,
        );
      } finally {
        await queryRunner.query('SELECT pg_advisory_unlock($1)', [
          IMAGE_HEALTH_LOCK_ID,
        ]);
      }
    } catch (error) {
      this.logger.error('External image health check failed:', error);
    } finally {
      await queryRunner.release();
    }
  }
}
