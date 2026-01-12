import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsEnum,
    IsDateString,
    IsBoolean,
    IsEmail,
} from 'class-validator';
import { Type } from 'class-transformer';
import { XenditWebhookStatus } from 'src/common/enums/status-xendit.enum'; 

export class PaymentWebhookDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    external_id: string;

    @IsEnum(XenditWebhookStatus)
    @IsNotEmpty()
    status: XenditWebhookStatus;

    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number)
    amount: number;

    @IsDateString()
    @IsNotEmpty()
    created: string;

    @IsDateString()
    @IsNotEmpty()
    updated: string;

    @IsOptional()
    @IsString()
    user_id?: string;

    @IsOptional()
    @IsBoolean()
    is_high?: boolean;

    @IsOptional()
    @IsString()
    payment_method?: string;

    @IsOptional()
    @IsString()
    merchant_name?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    paid_amount?: number;

    @IsOptional()
    @IsString()
    bank_code?: string;

    @IsOptional()
    @IsDateString()
    paid_at?: string;

    @IsOptional()
    @IsEmail()
    payer_email?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    adjusted_received_amount?: number;

    @IsOptional()
    @IsNumber()
    @Type(() => Number)
    fees_paid_amount?: number;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsString()
    payment_channel?: string;

    @IsOptional()
    @IsString()
    payment_destination?: string;
}