// Order.module.ts

import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';
import { MailModule } from '../../mail/mail.module';
import { TicketsModule } from '../tickets/tickets.module';
import { PaymentsModule } from '../payments/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Event]),
    MailModule,
    TicketsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService], 
})
export class OrdersModule {}