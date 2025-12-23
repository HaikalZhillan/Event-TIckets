export interface XenditInvoiceResponse {
    id: string;
    external_id: string;
    user_id?: string;
    is_high?: boolean;
    payment_method?: string;
    status: string;
    merchant_name?: string;
    amount: number;
    paid_amount?: number;
    bank_code?: string;
    paid_at?: string;
    payer_email?: string;
    description?: string;
    adjusted_received_amount?: number;
    fees_paid_amount?: number;
    updated: string;
    created: string;
    currency?: string;
    payment_channel?: string;
    payment_destination?: string;
    invoice_url?: string;
    expiry_date?: string;
    should_send_email?: boolean;
    items?: any[];
    fees?: any[];
}

export interface CreateInvoiceRequest {
    external_id: string;
    payer_email: string;
    description: string;
    amount: number;
    should_send_email?: boolean;
    callback_virtual_account_id?: string;
    success_redirect_url?: string;
    failure_redirect_url?: string;
    invoice_duration?: number;
    payment_methods?: string[];
    currency?: string;
    items?: any[];
    fees?: any[];
}