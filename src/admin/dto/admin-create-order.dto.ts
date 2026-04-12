import { OmitType } from '@nestjs/swagger';
import { CreateOrderDto } from '../../orders/dto/create-order.dto';

/** Admin-only create order body; checkout type and verification are enforced server-side. */
export class AdminCreateOrderDto extends OmitType(CreateOrderDto, [
  'checkoutType',
  'verificationToken',
] as const) {}
