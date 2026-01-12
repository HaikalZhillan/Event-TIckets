import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';
import { MailModule } from '../../mail/mail.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PaymentModule } from '../payments/payment.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Order, Event]),
    MailModule,
    forwardRef(() => TicketsModule), // Add forwardRef here
    forwardRef(() => PaymentModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}