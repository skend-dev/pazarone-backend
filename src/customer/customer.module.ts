import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { CustomerController } from './customer.controller';
import { CustomerAddress } from './entities/customer-address.entity';
import { CustomerNotificationPreferences } from './entities/customer-notification-preferences.entity';
import { User } from '../users/entities/user.entity';
import { UserIdentity } from '../users/entities/user-identity.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { PasswordReset } from '../auth/entities/password-reset.entity';
import { MarketingContact } from '../marketing/entities/marketing-contact.entity';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { AuthModule } from '../auth/auth.module';
import { MarketingModule } from '../marketing/marketing.module';
import { FirebaseAdminModule } from '../firebase/firebase-admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomerAddress,
      CustomerNotificationPreferences,
      User,
      UserIdentity,
      Notification,
      PasswordReset,
      MarketingContact,
    ]),
    forwardRef(() => UsersModule),
    forwardRef(() => OrdersModule),
    forwardRef(() => AuthModule),
    MarketingModule,
    FirebaseAdminModule,
  ],
  controllers: [CustomerController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
