import { Module } from '@nestjs/common';
import { EmailService } from '../auth/services/email.service';

/**
 * Standalone module that provides EmailService (only depends on ConfigModule,
 * which is global). Import this instead of AuthModule whenever you only need
 * to send emails, to avoid the AuthModule circular-dependency chain.
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
