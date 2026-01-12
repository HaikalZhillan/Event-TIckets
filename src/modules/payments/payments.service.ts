import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Xendit, XenditOpts } from 'xendit-node';
import { InvoiceApi } from 'xendit-node/invoice/apis';
import { CreateInvoiceRequest as XenditCreateInvoiceRequest } from 'xendit-node/invoice/models';
import { XenditInvoiceResponse, CreateInvoiceRequest } from './payment.types';
import { OrdersService } from '../orders/orders.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import {
  PaymentStatus,
  PaymentProvider,
  PaymentType,
} from 'src/common/enums/payment.enums';
import { XenditWebhookStatus } from 'src/common/enums/status-xendit.enum';
import { Payment } from '../../entities/payment.entity';
import { Order } from '../../entities/order.entity';
import { OrderStatus } from 'src/common/enums/order.enums';
import { TicketsService } from '../tickets/tickets.service';

export interface CreatePaymentDto {
  orderId: string;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly xenditClient: Xendit;
  private readonly invoiceApi: InvoiceApi;
  private readonly webhookToken: string;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => OrdersService))
    private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => TicketsService)) // Add this injection
    private readonly ticketsService: TicketsService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {
    const xenditOptions: XenditOpts = {
      secretKey: this.configService.get<string>('XENDIT_SECRET_KEY'),
    };

    this.xenditClient = new Xendit(xenditOptions);
    this.invoiceApi = this.xenditClient.Invoice;
    this.webhookToken = this.configService.get<string>('XENDIT_WEBHOOK_TOKEN');
  }

  getWebhookToken(): string {
    return this.webhookToken;
  }

  async create(
    createPaymentDto: CreatePaymentDto,
    userId: string,
  ): Promise<{ payment: any }> {
    const { orderId } = createPaymentDto;

    this.logger.log(`Creating payment for order: ${orderId}`);

    // Find the order with user and event relations
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'event'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found`);
    }

    // Check if payment already exists for this order
    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
    });

    if (existingPayment) {
      this.logger.log(`Payment already exists for order: ${orderId}`);
      return {
        payment: {
          id: existingPayment.id,
          referenceId: existingPayment.referenceId,
          paymentUrl: existingPayment.paymentUrl,
          amount: existingPayment.amount,
          status: existingPayment.status,
          expiresAt: existingPayment.expiresAt,
          isMock: false,
        },
      };
    }

    // Build invoice request for Xendit
    const invoiceData: CreateInvoiceRequest = {
      external_id: order.id,
      payer_email: order.user?.email || 'customer@example.com',
      description: `Payment for Order ${order.orderNumber} - ${(order.event as any)?.title || 'Event'}`,
      amount: Number(order.totalAmount),
      should_send_email: true,
      invoice_duration: 3600,
      success_redirect_url: `${this.configService.get<string>('FRONTEND_URL')}/payment/success?orderId=${order.id}`,
      failure_redirect_url: `${this.configService.get<string>('FRONTEND_URL')}/payment/failed?orderId=${order.id}`,
    };

    // Create Xendit invoice
    const xenditInvoice = await this.createInvoice(invoiceData);

    // Calculate expiry date
    const expiresAt = xenditInvoice.expiry_date
      ? new Date(xenditInvoice.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // 1 hour from now

    // Create payment record in database
    const payment = this.paymentRepository.create({
      orderId: order.id,
      provider: PaymentProvider.XENDIT,
      type: PaymentType.INVOICE,
      referenceId: xenditInvoice.id,
      amount: Number(order.totalAmount),
      status: PaymentStatus.PENDING,
      paymentUrl: xenditInvoice.invoice_url,
      expiresAt: expiresAt,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    this.logger.log(`Payment created successfully: ${savedPayment.id}`);

    return {
      payment: {
        id: savedPayment.id,
        referenceId: savedPayment.referenceId,
        paymentUrl: savedPayment.paymentUrl,
        amount: savedPayment.amount,
        status: savedPayment.status,
        expiresAt: savedPayment.expiresAt,
        isMock: false,
      },
    };
  }

  async createInvoice(
    invoiceData: CreateInvoiceRequest,
  ): Promise<XenditInvoiceResponse> {
    try {
      const xenditRequest: XenditCreateInvoiceRequest = {
        externalId: invoiceData.external_id,
        payerEmail: invoiceData.payer_email,
        description: invoiceData.description,
        amount: invoiceData.amount,
        shouldSendEmail: invoiceData.should_send_email,
        successRedirectUrl: invoiceData.success_redirect_url,
        failureRedirectUrl: invoiceData.failure_redirect_url,
      };

      if (invoiceData.callback_virtual_account_id) {
        xenditRequest.callbackVirtualAccountId =
          invoiceData.callback_virtual_account_id;
      }
      if (invoiceData.invoice_duration) {
        xenditRequest.invoiceDuration = invoiceData.invoice_duration;
      }
      if (invoiceData.payment_methods) {
        xenditRequest.paymentMethods = invoiceData.payment_methods;
      }
      if (invoiceData.currency) {
        xenditRequest.currency = invoiceData.currency;
      }
      if (invoiceData.items) {
        xenditRequest.items = invoiceData.items;
      }
      if (invoiceData.fees) {
        xenditRequest.fees = invoiceData.fees;
      }

      this.logger.log(
        'Creating invoice with request:',
        JSON.stringify(xenditRequest, null, 2),
      );

      const response = await this.invoiceApi.createInvoice({
        data: xenditRequest,
      });

      this.logger.log(
        'Received response from Xendit:',
        JSON.stringify(response, null, 2),
      );

      const formattedResponse: XenditInvoiceResponse =
        this.formatInvoiceResponse(response);

      this.logger.log(`Created invoice with ID: ${response.id}`);
      return formattedResponse;
    } catch (error) {
      this.logger.error('Failed to create Xendit invoice:', error);
      throw error;
    }
  }

  async getInvoice(invoiceId: string): Promise<XenditInvoiceResponse> {
    try {
      const response = await this.invoiceApi.getInvoiceById({
        invoiceId,
      });

      this.logger.log(
        'Received invoice from Xendit:',
        JSON.stringify(response, null, 2),
      );

      const formattedResponse: XenditInvoiceResponse =
        this.formatInvoiceResponse(response);

      return formattedResponse;
    } catch (error) {
      this.logger.error(`Failed to get invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  async expireInvoice(invoiceId: string): Promise<XenditInvoiceResponse> {
    try {
      const response = await this.invoiceApi.expireInvoice({
        invoiceId,
      });

      this.logger.log(
        'Received expired invoice from Xendit:',
        JSON.stringify(response, null, 2),
      );

      const formattedResponse: XenditInvoiceResponse =
        this.formatInvoiceResponse(response);

      return formattedResponse;
    } catch (error) {
      this.logger.error(`Failed to expire invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  private formatInvoiceResponse(response: any): XenditInvoiceResponse {
    const invoiceResponse = response;

    return {
      id: invoiceResponse.id || '',
      external_id:
        invoiceResponse.externalId || invoiceResponse.external_id || '',
      user_id: invoiceResponse.userId || invoiceResponse.user_id,
      is_high: invoiceResponse.isHigh || invoiceResponse.is_high,
      payment_method:
        invoiceResponse.paymentMethod || invoiceResponse.payment_method,
      status: invoiceResponse.status || '',
      merchant_name:
        invoiceResponse.merchantName || invoiceResponse.merchant_name,
      amount: invoiceResponse.amount || 0,
      paid_amount: invoiceResponse.paidAmount || invoiceResponse.paid_amount,
      bank_code: invoiceResponse.bankCode || invoiceResponse.bank_code,
      paid_at: invoiceResponse.paidAt || invoiceResponse.paid_at,
      payer_email: invoiceResponse.payerEmail || invoiceResponse.payer_email,
      description: invoiceResponse.description || '',
      adjusted_received_amount:
        invoiceResponse.adjustedReceivedAmount ||
        invoiceResponse.adjusted_received_amount,
      fees_paid_amount:
        invoiceResponse.feesPaidAmount || invoiceResponse.fees_paid_amount,
      updated: invoiceResponse.updated
        ? typeof invoiceResponse.updated === 'string'
          ? invoiceResponse.updated
          : invoiceResponse.updated.toISOString()
        : '',
      created: invoiceResponse.created
        ? typeof invoiceResponse.created === 'string'
          ? invoiceResponse.created
          : invoiceResponse.created.toISOString()
        : '',
      currency: invoiceResponse.currency,
      payment_channel:
        invoiceResponse.paymentChannel || invoiceResponse.payment_channel,
      payment_destination:
        invoiceResponse.paymentDestination ||
        invoiceResponse.payment_destination,
      invoice_url: invoiceResponse.invoiceUrl || invoiceResponse.invoice_url,
      expiry_date: invoiceResponse.expiryDate
        ? typeof invoiceResponse.expiryDate === 'string'
          ? invoiceResponse.expiryDate
          : invoiceResponse.expiryDate.toISOString()
        : undefined,
      should_send_email:
        invoiceResponse.shouldSendEmail || invoiceResponse.should_send_email,
      items: invoiceResponse.items,
      fees: invoiceResponse.fees,
    };
  }

  private mapPaymentStatusToOrderStatus(
    paymentStatus: PaymentStatus,
  ): OrderStatus {
    switch (paymentStatus) {
      case PaymentStatus.PAID:
        return OrderStatus.PAID;
      case PaymentStatus.EXPIRED:
        return OrderStatus.EXPIRED;
      case PaymentStatus.FAILED:
        return OrderStatus.CANCELLED;
      case PaymentStatus.PENDING:
      default:
        return OrderStatus.PENDING;
    }
  }

  async processWebhook(
    payload: PaymentWebhookDto,
    callbackToken: string,
  ): Promise<void> {
    if (callbackToken !== this.webhookToken) {
      this.logger.error('Webhook received with invalid token.');
      throw new UnauthorizedException('Invalid token');
    }

    this.logger.log(
      `Processing webhook for order ${payload.external_id} with status ${payload.status}`,
    );

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(payload.external_id)) {
      this.logger.warn(
        `external_id '${payload.external_id}' is not a valid UUID. This is likely a test webhook from Xendit dashboard.`,
      );
      return;
    }

    let newPaymentStatus: PaymentStatus;

    switch (payload.status) {
      case XenditWebhookStatus.PAID:
        newPaymentStatus = PaymentStatus.PAID;
        break;
      case XenditWebhookStatus.EXPIRED:
        newPaymentStatus = PaymentStatus.EXPIRED;
        break;
      case XenditWebhookStatus.PENDING:
        newPaymentStatus = PaymentStatus.PENDING;
        break;
      default:
        this.logger.log(
          `Received unhandled status: ${payload.status} for order ${payload.external_id}`,
        );
        return;
    }

    const order = await this.orderRepository.findOne({
      where: { id: payload.external_id },
      relations: ['user'],
    });

    if (!order) {
      this.logger.warn(
        `Order '${payload.external_id}' not found in database.`,
      );
      return;
    }

    const payment = await this.paymentRepository.findOne({
      where: { orderId: payload.external_id },
    });

    if (payment) {
      payment.status = newPaymentStatus;
      if (newPaymentStatus === PaymentStatus.PAID) {
        payment.paidAt = new Date();
        payment.paymentMethod = payload.payment_method || 'Unknown';
      }
      await this.paymentRepository.save(payment);
      this.logger.log(`Payment record updated: ${payment.id}`);
    }

    const newOrderStatus = this.mapPaymentStatusToOrderStatus(newPaymentStatus);

    await this.ordersService.updateStatus(payload.external_id, newOrderStatus, {
      paymentId: payload.id,
      paymentMethod: payload.payment_method,
      paidAt: payload.paid_at,
    });

    this.logger.log(
      `Order ${payload.external_id} status updated to ${newOrderStatus}`,
    );

    if (newPaymentStatus === PaymentStatus.PAID) {
      this.logger.log(
        `Payment successful for order ${payload.external_id}. Creating tickets.`,
      );

      try {
        const tickets = await this.ticketsService.generateTicketsForOrder(
          payload.external_id,
        );
        this.logger.log(
          `Generated ${tickets.length} tickets for order ${payload.external_id}`,
        );
      } catch (e) {
        this.logger.error(`Failed to generate tickets: ${e.message}`);
      }
    }
  }
}
