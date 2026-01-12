import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Ticket } from '../../entities/ticket.entity';
import { Event } from '../../entities/event.entity';
import { Order } from '../../entities/order.entity';
import { User } from '../../entities/user.entity';
import { Notification } from '../../entities/notification.entity';
import { EmailService } from './email.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly emailService: EmailService,
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    @InjectRepository(Event)
    private eventsRepo: Repository<Event>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private ticketsRepo: Repository<Ticket>,
  ) {}

  async sendTicketEmail(
    user: User,
    order: Order,
    tickets: Ticket[],
  ): Promise<void> {
    // Get event start time - use startTime (not startDate)
    const eventStartTime = (order.event as any).startTime || (order.event as any).eventDate;
    const eventDate = eventStartTime ? new Date(eventStartTime) : new Date();

    const data = {
      userName: user.name || user.email,
      eventName: (order.event as any).title,
      eventDate: eventDate.toLocaleDateString(),
      eventTime: eventDate.toLocaleTimeString(),
      eventLocation: (order.event as any).location,
      // Use ticketNumber (not ticketCode)
      ticketNumbers: tickets.map((t) => t.ticketNumber),
      orderTotal: order.totalAmount,
    };

    this.logger.log(`📧 Sending ticket email to ${user.email}`);
    await this.emailService.sendTicketEmail(user.email, user.id, data);
  }

  async scheduleEventReminder(user: User, event: Event): Promise<void> {
    // Use startTime (not startDate)
    const eventStartTime = (event as any).startTime || (event as any).eventDate;
    const eventDate = eventStartTime ? new Date(eventStartTime) : new Date();
    const reminderTime = new Date(eventDate.getTime() - 24 * 60 * 60 * 1000);

    if (reminderTime > new Date()) {
      this.logger.log(
        `⏰ Reminder scheduled for event ${event.id} at ${reminderTime}`,
      );
    }
  }

  @Cron('0 9 * * *') // Run at 9 AM every day
  async sendEventReminders(): Promise<void> {
    this.logger.log('🔔 Checking for event reminders...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Query events using startTime (not startDate) and status (not isPublished)
    const events = await this.eventsRepo
      .createQueryBuilder('event')
      .where('event.startTime >= :tomorrow', { tomorrow })
      .andWhere('event.startTime < :dayAfterTomorrow', { dayAfterTomorrow })
      .andWhere('event.status = :status', { status: 'published' })
      .getMany();

    for (const event of events) {
      // Get tickets for this event with order and user relations
      const tickets = await this.ticketsRepo.find({
        where: { eventId: event.id },
        relations: ['order', 'order.user'],
      });

      // Group tickets by user
      const usersMap = new Map<string, { user: User; tickets: Ticket[] }>();

      for (const ticket of tickets) {
        if (!ticket.order?.user) continue;

        const userId = ticket.order.user.id;
        if (!usersMap.has(userId)) {
          usersMap.set(userId, {
            user: ticket.order.user,
            tickets: [],
          });
        }
        usersMap.get(userId).tickets.push(ticket);
      }

      // Send reminder to each user
      for (const [userId, { user, tickets: userTickets }] of usersMap) {
        const eventStartTime = (event as any).startTime || (event as any).eventDate;
        const eventDate = eventStartTime ? new Date(eventStartTime) : new Date();

        const data = {
          userName: user.name || user.email,
          eventName: (event as any).title,
          eventDate: eventDate.toLocaleDateString(),
          eventTime: eventDate.toLocaleTimeString(),
          eventLocation: (event as any).location,
          // Use ticketNumber (not ticketCode)
          ticketNumbers: userTickets.map((t) => t.ticketNumber),
        };

        this.logger.log(`Sending reminder email to ${user.email}`);
        await this.emailService.sendReminderEmail(user.email, user.id, data);
      }
    }

    this.logger.log(
      `Sent reminders for ${events.length} events on ${tomorrow.toDateString()}`,
    );
  }

  async sendOrderExpiryNotification(orderId: string): Promise<void> {
    this.logger.log(`Order expiry notification for order ${orderId}`);

    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['user', 'event'],
    });

    if (order && order.user && order.event) {
      const data = {
        userName: order.user.name || order.user.email,
        orderId: order.id,
        eventName: (order.event as any).title,
        expiryDate: new Date().toISOString(),
      };

      await this.emailService.sendExpiryEmail(
        order.user.email,
        order.user.id,
        data,
      );
    }
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.notificationsRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationsRepo.count({
      where: { userId, status: 'pending' },
    });
  }

  async getNotificationById(
    id: string,
    userId: string,
  ): Promise<Notification> {
    const notification = await this.notificationsRepo.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.getNotificationById(id, userId);
    notification.status = 'read';
    return this.notificationsRepo.save(notification);
  }

  async markMultipleAsRead(ids: string[], userId: string): Promise<void> {
    await this.notificationsRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ status: 'read' })
      .where('id IN (:...ids)', { ids })
      .andWhere('userId = :userId', { userId })
      .execute();
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationsRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ status: 'read' })
      .where('userId = :userId', { userId })
      .andWhere('status != :status', { status: 'read' })
      .execute();
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    const notification = await this.getNotificationById(id, userId);
    await this.notificationsRepo.remove(notification);
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await this.notificationsRepo.delete({ userId });
  }
}