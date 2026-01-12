import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsController } from './payments.controller';
import { PaymentService } from './payments.service';
import { Payment } from '../../entities/payment.entity';
import { Order } from '../../entities/order.entity';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Order]),
    forwardRef(() => OrdersModule),
    forwardRef(() => TicketsModule), // Add this line
  ],
  providers: [PaymentService],
  controllers: [PaymentsController],
  exports: [PaymentService],
})
export class PaymentModule {}