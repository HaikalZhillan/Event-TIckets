//Order.Service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { FilterOrderDto } from './dto/filter-order.dto';

import { MailService } from '../../mail/mail.service';
import { TicketsService } from '../tickets/tickets.service';
import { PaymentsService } from '../payments/payments.service';

import { OrderStatus } from 'src/common/enums/order.enums';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly mailService: MailService,
    private readonly ticketsService: TicketsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
  ) {}

  private generateOrderNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}${month}${day}-${random}`;
  }

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}${day}-${random}`;
  }

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { eventId, quantity } = createOrderDto;

    this.logger.log(`Creating order for user=${userId} event=${eventId} qty=${quantity}`);

    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      relations: ['category'],
    });

    if (!event) throw new NotFoundException(`Event with ID '${eventId}' not found`);

    const eventStatus = (event as any).status || 'published';
    if (eventStatus !== 'published') throw new BadRequestException('Event is not available for booking');

    const eventStartTime = (event as any).startTime || (event as any).eventDate;
    if (eventStartTime && new Date(eventStartTime) < new Date()) {
      throw new BadRequestException('Event has already passed');
    }

    const availableTickets = (event as any).quota ?? (event as any).availableTickets ?? 0;
    if (availableTickets < quantity) {
      throw new BadRequestException(`Only ${availableTickets} tickets available`);
    }

    const unitPrice = Number(event.price);
    const totalAmount = unitPrice * quantity;

    const orderNumber = this.generateOrderNumber();
    const invoiceNumber = this.generateInvoiceNumber();

    const expiredAt = new Date();
    expiredAt.setHours(expiredAt.getHours() + 1);

    const order = this.orderRepository.create({
      orderNumber,
      invoiceNumber,
      userId,
      eventId,
      quantity,
      unitPrice,
      totalAmount,
      status: OrderStatus.PENDING,
      expiredAt,
    });

    const savedOrder = await this.orderRepository.save(order);
    this.logger.log(`Order created: ${savedOrder.id} (${savedOrder.orderNumber})`);

    try {
      if ('quota' in event) (event as any).quota -= quantity;
      else if ('availableTickets' in event) (event as any).availableTickets -= quantity;
      await this.eventRepository.save(event);
    } catch (e) {
      await this.orderRepository.delete({ id: savedOrder.id });
      throw new BadRequestException('Failed to reserve quota');
    }

    let paymentData: any = null;
    try {
      const paymentResult = await this.paymentsService.create(
        { orderId: savedOrder.id },
        userId,
      );

      paymentData = paymentResult.payment;
      this.logger.log(`Payment created: ref=${paymentData.referenceId}`);
    } catch (paymentError) {
      this.logger.error(`Failed to create payment: ${paymentError.message}`);

      try {
        if ('quota' in event) (event as any).quota += quantity;
        else if ('availableTickets' in event) (event as any).availableTickets += quantity;
        await this.eventRepository.save(event);
      } catch (restoreErr) {
        this.logger.error(`Failed to restore quota after payment fail: ${restoreErr.message}`);
      }

      await this.orderRepository.delete({ id: savedOrder.id });

      throw new BadRequestException('Failed to create invoice/payment');
    }

    try {
      const orderWithUser = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['user'],
      });

      if (orderWithUser?.user) {
        await this.mailService.sendOrderCreatedEmail({
          email: orderWithUser.user.email,
          userName: orderWithUser.user.name || orderWithUser.user.email,
          orderNumber: savedOrder.orderNumber,
          invoiceNumber: savedOrder.invoiceNumber,
          eventTitle: (event as any).title,
          quantity: savedOrder.quantity,
          totalAmount: savedOrder.totalAmount,
          expiredAt: savedOrder.expiredAt,
          paymentUrl: paymentData?.paymentUrl,
        } as any);
      }
    } catch (emailError) {
      this.logger.warn(`Failed to send order created email: ${emailError.message}`);
    }

    return {
      message: 'Order created successfully',
      order: {
        id: savedOrder.id,
        orderNumber: savedOrder.orderNumber,
        invoiceNumber: savedOrder.invoiceNumber,
        quantity: savedOrder.quantity,
        unitPrice: savedOrder.unitPrice,
        totalAmount: savedOrder.totalAmount,
        status: savedOrder.status,
        expiredAt: savedOrder.expiredAt,
        createdAt: savedOrder.createdAt,
        event: {
          id: event.id,
          title: (event as any).title,
          price: event.price,
          startTime: eventStartTime,
        },
      },
      payment: paymentData
        ? {
            id: paymentData.id,
            referenceId: paymentData.referenceId,
            paymentUrl: paymentData.paymentUrl,
            amount: paymentData.amount,
            status: paymentData.status,
            expiresAt: paymentData.expiresAt,
            isMock: paymentData.isMock,
          }
        : null,
    };
  }

  async findAll(filterDto: FilterOrderDto, userId?: string, userRole?: string) {
    const { status, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = filterDto;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.event', 'event')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.payment', 'payment');

    if (userRole !== 'admin' && userId) {
      queryBuilder.where('order.userId = :userId', { userId });
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status });
    }

    queryBuilder.orderBy(`order.${sortBy}`, sortOrder as 'ASC' | 'DESC');

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    const formattedData = data.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber,
      quantity: order.quantity,
      totalAmount: order.totalAmount,
      status: order.status,
      expiredAt: order.expiredAt,
      createdAt: order.createdAt,
      event: {
        id: order.event?.id,
        title: (order.event as any)?.title,
        startTime: (order.event as any)?.startTime || (order.event as any)?.eventDate,
      },
      user:
        userRole === 'admin'
          ? {
              id: order.user?.id,
              email: order.user?.email,
              name: order.user?.name,
            }
          : undefined,
      payment: order.payment
        ? {
            id: order.payment.id,
            status: order.payment.status,
            paymentMethod: order.payment.paymentMethod,
            paidAt: order.payment.paidAt,
          }
        : null,
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId?: string, userRole?: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['event', 'event.category', 'user', 'payment', 'tickets'],
    });

    if (!order) throw new NotFoundException(`Order with ID '${id}' not found`);

    if (userRole !== 'admin' && order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this order');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber,
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      totalAmount: order.totalAmount,
      status: order.status,
      expiredAt: order.expiredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      event: {
        id: order.event?.id,
        title: (order.event as any)?.title,
        description: (order.event as any)?.description,
        location: (order.event as any)?.location,
        startTime: (order.event as any)?.startTime || (order.event as any)?.eventDate,
        price: order.event?.price,
        category: (order.event as any)?.category?.name,
      },
      user:
        userRole === 'admin'
          ? {
              id: order.user?.id,
              email: order.user?.email,
              name: order.user?.name,
            }
          : undefined,
      payment: order.payment
        ? {
            id: order.payment.id,
            referenceId: order.payment.referenceId,
            paymentMethod: order.payment.paymentMethod,
            status: order.payment.status,
            amount: order.payment.amount,
            paymentUrl: order.payment.paymentUrl,
            paidAt: order.payment.paidAt,
          }
        : null,
      tickets: order.tickets?.map((ticket) => ({
        id: ticket.id,
        ticketNumber: (ticket as any).ticketNumber || ticket.id,
        status: (ticket as any).status,
        seatNumber: (ticket as any).seatNumber,
      })),
    };
  }

  async updateStatus(id: string, status: OrderStatus, paymentData?: any) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['event', 'user', 'payment', 'tickets'],
    });

    if (!order) throw new NotFoundException(`Order with ID '${id}' not found`);

    if (order.status === status) {
      this.logger.log(`Idempotent updateStatus: order=${id} already=${status}`);
      return order;
    }

    const oldStatus = order.status;
    this.logger.log(`Updating order ${id} status: ${oldStatus} → ${status}`);

    order.status = status;

    if (
      (status === OrderStatus.CANCELLED || status === OrderStatus.EXPIRED) &&
      (oldStatus === OrderStatus.PENDING || oldStatus === OrderStatus.AWAITING_PAYMENT)
    ) {
      const event = await this.eventRepository.findOne({ where: { id: order.eventId } });
      if (event) {
        if ('quota' in event) (event as any).quota += order.quantity;
        else if ('availableTickets' in event) (event as any).availableTickets += order.quantity;
        await this.eventRepository.save(event);
      }

      if (order.tickets?.length) {
        try {
          await this.ticketsService.batchCancelTickets(
            order.tickets.map((t) => t.id),
            `Order ${status}`,
          );
        } catch (e) {
          this.logger.warn(`Failed to batch cancel tickets: ${e.message}`);
        }
      }
    }

    const savedOrder = await this.orderRepository.save(order);

    if (status === OrderStatus.PAID && oldStatus !== OrderStatus.PAID && order.user && order.event) {
      try {
        const eventStartTime = (order.event as any).startTime || (order.event as any).eventDate;

        let tickets = order.tickets;
        if (!tickets || tickets.length === 0) {
          tickets = await this.ticketsService.generateTicketsForOrder(id);
        }

        await this.mailService.sendOrderPaidEmail({
          email: order.user.email,
          userName: order.user.name || order.user.email,
          orderNumber: order.orderNumber,
          invoiceNumber: order.invoiceNumber,
          eventTitle: (order.event as any).title,
          eventLocation: (order.event as any).location,
          eventStartTime,
          quantity: order.quantity,
          totalAmount: order.totalAmount,
          paidAt: order.payment?.paidAt || new Date(),
          paymentMethod: paymentData?.paymentMethod || order.payment?.paymentMethod || 'Unknown',
          tickets: tickets?.map((t: any) => ({
            id: t.id,
            ticketNumber: t.id,
            qrCodeUrl: t.qrCodeUrl,
            pdfUrl: t.pdfUrl,
          })),
        } as any);
      } catch (e) {
        this.logger.error(`Failed post-paid processing: ${e.message}`);
      }
    }

    return savedOrder;
  }

  async cancel(id: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['event', 'payment', 'user', 'tickets'],
    });

    if (!order) throw new NotFoundException(`Order with ID '${id}' not found`);

    if (order.userId !== userId) throw new ForbiddenException('You do not have permission to cancel this order');

    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.AWAITING_PAYMENT) {
      throw new BadRequestException(`Cannot cancel order with status '${order.status}'`);
    }

    if (order.payment && order.payment.status === 'paid') {
      throw new BadRequestException('Cannot cancel a paid order');
    }

    await this.updateStatus(id, OrderStatus.CANCELLED);

    try {
      await this.mailService.sendOrderCancelledEmail({
        email: order.user.email,
        userName: order.user.name || order.user.email,
        orderNumber: order.orderNumber,
        eventTitle: (order.event as any).title,
        cancelledAt: new Date(),
      } as any);
    } catch (e) {
      this.logger.warn(`Failed to send cancellation email: ${e.message}`);
    }

    return { message: 'Order cancelled successfully' };
  }

  async expireOrders() {
    this.logger.log('Starting order expiration check...');

    const now = new Date();

    const expiredOrders = await this.orderRepository.find({
      where: {
        status: OrderStatus.PENDING,
        expiredAt: LessThan(now),
      },
      relations: ['event', 'user', 'tickets'],
    });

    for (const order of expiredOrders) {
      try {
        await this.updateStatus(order.id, OrderStatus.EXPIRED);

        try {
          await this.mailService.sendOrderExpiredEmail({
            email: order.user.email,
            userName: order.user.name || order.user.email,
            orderNumber: order.orderNumber,
            eventTitle: (order.event as any).title,
          } as any);
        } catch (e) {
          this.logger.warn(`Failed to send expiry email: ${e.message}`);
        }
      } catch (e) {
        this.logger.error(`Error expiring order ${order.id}: ${e.message}`);
      }
    }

    return {
      message: `${expiredOrders.length} orders expired`,
      count: expiredOrders.length,
    };
  }

  async resendOrderEmail(orderId: string, userId: string, userRole?: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['event', 'user', 'tickets', 'payment'],
    });

    if (!order) throw new NotFoundException(`Order '${orderId}' not found`);

    if (userRole !== 'admin' && order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to resend this email');
    }

    if (!order.user) throw new BadRequestException('Order has no associated user email');

    if (order.status === OrderStatus.PENDING || order.status === OrderStatus.AWAITING_PAYMENT) {
      await this.mailService.sendOrderCreatedEmail({
        email: order.user.email,
        userName: order.user.name || order.user.email,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber,
        eventTitle: (order.event as any)?.title,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        expiredAt: order.expiredAt,
        paymentUrl: order.payment?.paymentUrl,
      } as any);
    } else if (order.status === OrderStatus.PAID) {
      await this.mailService.sendOrderPaidEmail({
        email: order.user.email,
        userName: order.user.name || order.user.email,
        orderNumber: order.orderNumber,
        invoiceNumber: order.invoiceNumber,
        eventTitle: (order.event as any)?.title,
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        tickets: order.tickets?.map((t: any) => ({
          id: t.id,
          ticketNumber: t.id,
          qrCodeUrl: t.qrCodeUrl,
          pdfUrl: t.pdfUrl,
        })),
      } as any);
    }

    return { message: 'Order email resent successfully' };
  }

  async createPaymentForOrder(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['event', 'user', 'payment'],
    });

    if (!order) throw new NotFoundException(`Order with ID '${orderId}' not found`);
    if (order.userId !== userId) throw new ForbiddenException('You do not have permission to create payment for this order');

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order cannot be paid in current status');
    }

    if (order.payment) throw new BadRequestException('Payment already exists for this order');

    const paymentResult = await this.paymentsService.create({ orderId: order.id }, userId);

    await this.updateStatus(orderId, OrderStatus.AWAITING_PAYMENT);

    return {
      message: 'Payment created successfully',
      payment: paymentResult.payment,
    };
  }
}
