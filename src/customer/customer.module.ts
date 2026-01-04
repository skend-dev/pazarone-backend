import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerNotificationPreferences } from './entities/customer-notification-preferences.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerAddress,
      CustomerNotificationPreferences,
      User,
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
