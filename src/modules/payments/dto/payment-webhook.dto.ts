import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsNumber,
    IsEnum,
    IsUUID,
    IsDateString,
    IsBoolean,
    IsEmail,
} from 'class-validator';
import { XenditWebhookStatus } from 'src/common/enums/status-xendit.enum';
import { Type } from 'class-transformer';

// Kita ubah interface dari xendit.types.ts menjadi class DTO
export class XenditWebhookDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    // Kita asumsikan external_id adalah UUID order Anda.
    @IsUUID()
    @IsNotEmpty()
    external_id: string;

    // Validasi menggunakan Enum yang baru kita buat
    @IsEnum(XenditWebhookStatus)
    @IsNotEmpty()
    status: XenditWebhookStatus;

    @IsNumber()
    @IsNotEmpty()
    @Type(() => Number) // Membantu transformasi jika payload mengirim angka sebagai string
    amount: number;

    @IsDateString()
    @IsNotEmpty()
    created: string;

    @IsDateString()
    @IsNotEmpty()
    updated: string;

    // --- Bidang Opsional ---

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