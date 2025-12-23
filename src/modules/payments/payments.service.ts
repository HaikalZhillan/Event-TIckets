import { forwardRef, Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Xendit, XenditOpts } from 'xendit-node';
import { InvoiceApi } from 'xendit-node/invoice/apis';
import { CreateInvoiceRequest as XenditCreateInvoiceRequest } from 'xendit-node/invoice/models';
import { XenditInvoiceResponse, CreateInvoiceRequest } from './xendit.types';
import { OrdersService } from '../order/orders.service';
import { XenditWebhookDto } from './dto/xendit-webhook.dto';
import { PaymentStatus } from 'src/common/enums/payment-status.enum';
import { XenditWebhookStatus } from 'src/common/enums/status-xendit.enum';

@Injectable()
export class XenditService {
    private readonly logger = new Logger(XenditService.name);
    private readonly xenditClient: Xendit;
    private readonly invoiceApi: InvoiceApi;
    private readonly webhookToken: string;

    constructor(
        private configService: ConfigService,
        @Inject(forwardRef(() => OrdersService))
        private readonly ordersService: OrdersService,
    ) {
        const xenditOptions: XenditOpts = {
            secretKey: this.configService.get<string>('XENDIT_SECRET_KEY'),
        };

        this.xenditClient = new Xendit(xenditOptions);
        this.invoiceApi = this.xenditClient.Invoice;
        this.webhookToken = this.configService.get<string>(
            'XENDIT_WEBHOOK_TOKEN',
        );
    }

    getWebhookToken(): string {
        return this.webhookToken;
    }

    async createInvoice(
        invoiceData: CreateInvoiceRequest,
    ): Promise<XenditInvoiceResponse> {
        try {
            // Convert our snake_case interface to the SDK's camelCase interface
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
            paid_amount:
                invoiceResponse.paidAmount || invoiceResponse.paid_amount,
            bank_code: invoiceResponse.bankCode || invoiceResponse.bank_code,
            paid_at: invoiceResponse.paidAt || invoiceResponse.paid_at,
            payer_email:
                invoiceResponse.payerEmail || invoiceResponse.payer_email,
            description: invoiceResponse.description || '',
            adjusted_received_amount:
                invoiceResponse.adjustedReceivedAmount ||
                invoiceResponse.adjusted_received_amount,
            fees_paid_amount:
                invoiceResponse.feesPaidAmount ||
                invoiceResponse.fees_paid_amount,
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
                invoiceResponse.paymentChannel ||
                invoiceResponse.payment_channel,
            payment_destination:
                invoiceResponse.paymentDestination ||
                invoiceResponse.payment_destination,
            invoice_url:
                invoiceResponse.invoiceUrl || invoiceResponse.invoice_url,
            expiry_date: invoiceResponse.expiryDate
                ? typeof invoiceResponse.expiryDate === 'string'
                    ? invoiceResponse.expiryDate
                    : invoiceResponse.expiryDate.toISOString()
                : undefined,
            should_send_email:
                invoiceResponse.shouldSendEmail ||
                invoiceResponse.should_send_email,
            items: invoiceResponse.items,
            fees: invoiceResponse.fees,
        };
    }

    async processWebhook(
        payload: XenditWebhookDto,
        callbackToken: string,
    ): Promise<void> {
        // Poin 5: Validasi callback token ada di level service
        if (callbackToken !== this.webhookToken) {
            this.logger.error('Webhook received with invalid token.');
            // Gunakan exception NestJS, jangan return res.send()
            throw new UnauthorizedException('Invalid token');
        }

        this.logger.log(
            `Processing webhook for order ${payload.external_id} with status ${payload.status}`,
        );

        // Poin 1 & 2: Validasi external_id & UUID sudah tidak perlu,
        // DTO (@IsUUID, @IsNotEmpty) sudah menanganinya.

        let newStatus: PaymentStatus;

        // Poin 3 & 4: Logika mapping & menggunakan switch case
        switch (payload.status) {
            case XenditWebhookStatus.PAID:
                newStatus = PaymentStatus.PAID;
                break;
            case XenditWebhookStatus.EXPIRED:
                newStatus = PaymentStatus.EXPIRED;
                break;
            case XenditWebhookStatus.PENDING:
                newStatus = PaymentStatus.PENDING;
                break;
            default:
                // Status lain yang valid (misal 'FAILED') tapi tidak kita tangani
                this.logger.log(
                    `Received unhandled status: ${payload.status} for order ${payload.external_id}`,
                );
                return; // Selesai, tidak perlu proses lebih lanjut
        }

        // Poin 3: Logika pemanggilan service lain
        await this.ordersService.updateOrderStatus(
            payload.external_id,
            newStatus,
            payload.id,
        );

        if (newStatus === PaymentStatus.PAID) {
            this.logger.log(
                `Payment successful for order ${payload.external_id}. Creating tickets.`,
            );

            await this.ordersService.createTicketsForPaidOrder(
                payload.external_id,
            );
        }
    }
}