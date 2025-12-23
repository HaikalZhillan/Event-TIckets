// xendit.service.ts

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';



export interface CreateInvoiceItem {
  name: string;
  quantity: number;
  price: number;
  category?: string;
}

export interface CreateInvoiceCustomer {
  given_names?: string;
  surname?: string;
  email: string;
  mobile_number?: string;
}

export interface CreateInvoiceDto {
  externalId: string;
  amount: number;
  payerEmail: string;
  description: string;
  invoiceDuration?: number;
  successRedirectUrl?: string;
  failureRedirectUrl?: string;
  currency?: string; // default 'IDR'
  items?: CreateInvoiceItem[];
  customer?: CreateInvoiceCustomer;
}

// =========================
// RESPONSE: data dari Xendit
// =========================

export type XenditInvoiceStatus =
  | 'PENDING'
  | 'PAID'
  | 'SETTLED'
  | 'EXPIRED'
  | 'FAILED'
  | 'REFUNDED'
  | string;

export interface XenditInvoiceResponse {
  id: string;
  external_id: string;
  user_id: string;
  status: XenditInvoiceStatus;
  merchant_name: string;
  amount: number;
  paid_amount?: number;
  adjusted_received_amount?: number;
  fees_paid_amount?: number;
  currency: string;
  payer_email?: string;
  description?: string;
  payment_method?: string;
  payment_channel?: string;
  payment_destination?: string;
  bank_code?: string;
  is_high?: boolean;
  created: string;
  updated: string;
  paid_at?: string;
  expiry_date?: string;
  invoice_url?: string;
  items?: CreateInvoiceItem[];
  customer?: CreateInvoiceCustomer;
  [key: string]: any;
}

@Injectable()
export class XenditService {
  private readonly logger = new Logger(XenditService.name);
  private readonly xenditApi: AxiosInstance;
  private readonly apiKey: string;
  private readonly callbackToken: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('XENDIT_SECRET_KEY')!;
    this.callbackToken = this.configService.get<string>('XENDIT_CALLBACK_TOKEN') ?? '';

    if (!this.apiKey) {
      throw new Error('XENDIT_SECRET_KEY is not configured');
    }

    this.xenditApi = axios.create({
      baseURL: 'https://api.xendit.co',
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        username: this.apiKey,
        password: '',
      },
    });
  }

  // =========================
  // CREATE INVOICE
  // =========================
  async createInvoice(data: CreateInvoiceDto): Promise<XenditInvoiceResponse> {
    try {
      this.logger.log(`Creating Xendit invoice for externalId=${data.externalId}`);

      const payload = {
        external_id: data.externalId,
        amount: data.amount,
        payer_email: data.payerEmail,
        description: data.description,
        invoice_duration: data.invoiceDuration || 3600,
        success_redirect_url: data.successRedirectUrl,
        failure_redirect_url: data.failureRedirectUrl,
        currency: data.currency || 'IDR',
        items: data.items,
        customer: data.customer,
      };

      const response = await this.xenditApi.post<XenditInvoiceResponse>(
        '/v2/invoices',
        payload,
      );

      this.logger.log(`Xendit invoice created: ${response.data.id}`);
      return response.data;
    } catch (err) {
      const error = err as AxiosError<any>;
      this.logger.error(`Failed to create Xendit invoice: ${error.message}`);

      if (error.response) {
        this.logger.error(
          `Xendit error response: ${JSON.stringify(error.response.data)}`,
        );
      }

      throw new BadRequestException('Failed to create payment invoice');
    }
  }

  // =========================
  // GET INVOICE
  // =========================
  async getInvoice(invoiceId: string): Promise<XenditInvoiceResponse> {
    try {
      this.logger.debug(`Fetching Xendit invoice: ${invoiceId}`);

      const response = await this.xenditApi.get<XenditInvoiceResponse>(
        `/v2/invoices/${invoiceId}`,
      );

      return response.data;
    } catch (err) {
      const error = err as AxiosError<any>;
      this.logger.error(`Failed to fetch Xendit invoice: ${error.message}`);

      if (error.response) {
        this.logger.error(
          `Xendit error response: ${JSON.stringify(error.response.data)}`,
        );
      }

      throw new BadRequestException('Failed to fetch payment invoice');
    }
  }

  // =========================
  // EXPIRE INVOICE
  // =========================
  async expireInvoice(invoiceId: string): Promise<XenditInvoiceResponse> {
    try {
      this.logger.log(`Expiring Xendit invoice: ${invoiceId}`);

      const response = await this.xenditApi.post<XenditInvoiceResponse>(
        `/v2/invoices/${invoiceId}/expire`,
      );

      this.logger.log(`Xendit invoice expired: ${invoiceId}`);
      return response.data;
    } catch (err) {
      const error = err as AxiosError<any>;
      this.logger.error(`Failed to expire Xendit invoice: ${error.message}`);

      if (error.response) {
        this.logger.error(
          `Xendit error response: ${JSON.stringify(error.response.data)}`,
        );
      }

      throw new BadRequestException('Failed to expire payment invoice');
    }
  }

  // =========================
  // VALIDATE WEBHOOK
  // =========================
  validateWebhookSignature(webhookToken: string | undefined | null): boolean {
    if (!this.callbackToken) {
      this.logger.warn('XENDIT_CALLBACK_TOKEN not configured');
      return false;
    }
    if (!webhookToken) {
      this.logger.warn('Webhook token not provided');
      return false;
    }

    const isValid = webhookToken === this.callbackToken;

    if (!isValid) {
      this.logger.warn('Invalid Xendit webhook token');
    }

    return isValid;
  }
}