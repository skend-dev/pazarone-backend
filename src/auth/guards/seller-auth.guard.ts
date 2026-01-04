import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserType } from '../../users/entities/user.entity';

@Injectable()
export class SellerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.userType !== UserType.SELLER) {
      throw new ForbiddenException('Seller access required');
    }

    return true;
  }
}
