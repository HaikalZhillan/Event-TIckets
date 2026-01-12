import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { Notification } from '../../entities/notification.entity';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { Ticket } from '../../entities/ticket.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, Event, Order, Ticket]),
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}