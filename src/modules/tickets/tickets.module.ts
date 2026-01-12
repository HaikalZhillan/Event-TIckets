import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { Ticket } from '../../entities/ticket.entity';
import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Ticket, Order, Event]),
    forwardRef(() => OrdersModule), // Add forwardRef here
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}