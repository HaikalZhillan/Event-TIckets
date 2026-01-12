//payments.controller.ts

import {
    Controller,
    Post,
    Body,
    Headers,
    Res,
    HttpStatus,
    Logger,
    Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response, Request } from 'express';
import { PaymentService } from './payments.service';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Xendit')
@Controller('xendit')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(private readonly xenditService: PaymentService) {}

    // Pindahkan method handlePaymentWebhook ke sini
    @Post('webhook') // Route lengkapnya menjadi /xendit/webhook
    @Public()
    @ApiOperation({ summary: 'Handle Xendit payment webhook' })
    @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid payload' })
    @ApiResponse({ status: 401, description: 'Invalid token' })
    async handlePaymentWebhook(
        // Poin 2: Hapus ValidationPipe di sini
        @Body() payload: PaymentWebhookDto,
        @Headers('x-callback-token') callbackToken: string,
        @Res() res: Response,
        @Req() req: Request,
    ): Promise<Response> {
        this.logger.log(
            `Webhook request received at ${req.url} from ${req.ip}`,
        );

        await this.xenditService.processWebhook(payload, callbackToken);

        return res.status(HttpStatus.OK).send('Webhook received');
    }
}