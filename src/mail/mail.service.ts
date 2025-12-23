import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('MAIL_HOST'),
      port: this.configService.get('MAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASS'),
      },
    });
  }

  async sendOrderCreatedEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    invoiceNumber: string;
    eventTitle: string;
    quantity: number;
    totalAmount: number;
    expiredAt: Date;
    paymentUrl?: string;
  }) {
    const { email, userName, orderNumber, invoiceNumber, eventTitle, quantity, totalAmount, expiredAt, paymentUrl } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM'),
      to: email,
      subject: `Order Confirmation - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .order-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .total { font-size: 1.2em; font-weight: bold; color: #4F46E5; }
            .warning { background-color: #fef3c7; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Confirmation</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Thank you for your order! Your booking has been successfully created.</p>
              
              <div class="order-details">
                <h2>Order Details</h2>
                <div class="detail-row">
                  <span class="detail-label">Order Number:</span>
                  <span class="detail-value">${orderNumber}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Invoice Number:</span>
                  <span class="detail-value">${invoiceNumber}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Event:</span>
                  <span class="detail-value">${eventTitle}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Quantity:</span>
                  <span class="detail-value">${quantity} ticket(s)</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Total Amount:</span>
                  <span class="detail-value total">Rp ${totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div class="warning">
                <strong>⏰ Payment Deadline:</strong><br>
                Please complete your payment before <strong>${new Date(expiredAt).toLocaleString('id-ID', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}</strong><br>
                Your order will be automatically cancelled if payment is not received.
              </div>

              ${paymentUrl ? `
                <div style="text-align: center;">
                  <a href="${paymentUrl}" class="button">Pay Now</a>
                </div>
              ` : ''}

              <p>If you have any questions, please don't hesitate to contact our support team.</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Event Ticketing System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Order created email sent to ${email}`);
    } catch (error) {
      console.error('Error sending order created email:', error);
      throw error;
    }
  }

  async sendOrderPaidEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    invoiceNumber: string;
    eventTitle: string;
    eventLocation?: string;
    eventStartTime: Date;
    quantity: number;
    totalAmount: number;
    paidAt: Date;
    paymentMethod: string;
    tickets?: Array<{
      id: string;
      ticketNumber: string;
      seatNumber?: string;
      qrCodeUrl?: string;
      pdfUrl?: string;
    }>;
  }) {
    const { 
      email, 
      userName, 
      orderNumber, 
      invoiceNumber, 
      eventTitle, 
      eventLocation,
      eventStartTime,
      quantity, 
      totalAmount, 
      paidAt,
      paymentMethod,
      tickets 
    } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM'),
      to: email,
      subject: `Payment Successful - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
            .success-badge { font-size: 3em; }
            .content { background-color: #f9fafb; padding: 30px; }
            .order-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .total { font-size: 1.2em; font-weight: bold; color: #10b981; }
            .success-box { background-color: #d1fae5; padding: 15px; margin: 20px 0; border-left: 4px solid #10b981; border-radius: 4px; }
            .event-info { background-color: #e0e7ff; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .tickets-list { background-color: #fef3c7; padding: 15px; margin: 20px 0; border-radius: 8px; }
            .ticket-item { padding: 8px 0; font-family: monospace; }
            .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-badge">✅</div>
              <h1>Payment Successful!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Great news! Your payment has been confirmed and your tickets are ready.</p>
              
              <div class="success-box">
                <strong>Payment Status: PAID</strong><br>
                Paid on: ${new Date(paidAt).toLocaleString('id-ID', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}<br>
                Payment Method: ${paymentMethod}
              </div>

              <div class="order-details">
                <h2>Payment Details</h2>
                <div class="detail-row">
                  <span class="detail-label">Order Number:</span>
                  <span class="detail-value">${orderNumber}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Invoice Number:</span>
                  <span class="detail-value">${invoiceNumber}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Quantity:</span>
                  <span class="detail-value">${quantity} ticket(s)</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Total Paid:</span>
                  <span class="detail-value total">Rp ${totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              <div class="event-info">
                <h2>Event Information</h2>
                <p><strong>${eventTitle}</strong></p>
                ${eventLocation ? `<p><strong>Location:</strong> ${eventLocation}</p>` : ''}
                <p><strong>Date & Time:</strong> ${new Date(eventStartTime).toLocaleString('id-ID', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}</p>
              </div>

              ${tickets && tickets.length > 0 ? `
                <div class="tickets-list">
                  <h3>Your Tickets</h3>

                  ${tickets.map(ticket => `
                    <div class="ticket-item" style="margin-bottom:15px;">
                      <div><strong>Ticket:</strong> ${ticket.ticketNumber}</div>
                      ${ticket.seatNumber ? `<div>Seat: ${ticket.seatNumber}</div>` : ''}

                      ${ticket.qrCodeUrl ? `
                        <div style="margin:10px 0;">
                          <img 
                            src="${ticket.qrCodeUrl}" 
                            alt="QR Code Ticket"
                            width="120"
                            style="border:1px solid #ddd; padding:5px;"
                          />
                        </div>
                        ` : ''}

                      ${ticket.pdfUrl ? `
                        <div>
                          <a 
                            href="${ticket.pdfUrl}" 
                            target="_blank"
                            style="
                              display:inline-block;
                              background:#10b981;
                              color:#fff;
                              padding:8px 16px;
                              border-radius:6px;
                              text-decoration:none;
                              font-size:14px;
                            "
                          >
                            Download Ticket (PDF)
                          </a>
                        </div>
                      ` : ''}
                      <hr style="margin-top:15px;" />
                    </div>
                  `).join('')}
                </div>
              ` : ''}


              <div style="text-align: center;">
                <p><strong>Ready to attend the event?</strong></p>
                <p>Please save this email and present your tickets at the venue.</p>
              </div>

              <p>If you have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>This is an automated email. Please do not reply.</p>
              <p>&copy; ${new Date().getFullYear()} Event Ticketing System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Payment confirmation email sent to ${email}`);
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  async sendOrderCancelledEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    eventTitle: string;
    cancelledAt: Date;
  }) {
    const { email, userName, orderNumber, eventTitle, cancelledAt } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM'),
      to: email,
      subject: `Order Cancelled - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .info-box { background-color: #fee2e2; padding: 15px; margin: 20px 0; border-left: 4px solid #ef4444; }
            .footer { text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Cancelled</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Your order has been cancelled as requested.</p>
              
              <div class="info-box">
                <strong>Order Number:</strong> ${orderNumber}<br>
                <strong>Event:</strong> ${eventTitle}<br>
                <strong>Cancelled on:</strong> ${new Date(cancelledAt).toLocaleString('id-ID', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}
              </div>

              <p>If you have any questions or this was a mistake, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Event Ticketing System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Order cancelled email sent to ${email}`);
    } catch (error) {
      console.error('Error sending order cancelled email:', error);
      throw error;
    }
  }

  async sendOrderExpiredEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    eventTitle: string;
  }) {
    const { email, userName, orderNumber, eventTitle } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM'),
      to: email,
      subject: `Order Expired - ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9fafb; padding: 30px; }
            .warning-box { background-color: #fef3c7; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Order Expired</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${userName}</strong>,</p>
              <p>Unfortunately, your order has expired due to unpaid payment.</p>
              
              <div class="warning-box">
                <strong>Order Number:</strong> ${orderNumber}<br>
                <strong>Event:</strong> ${eventTitle}
              </div>

              <p>You can create a new order if you still want to attend this event.</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Event Ticketing System. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Order expired email sent to ${email}`);
    } catch (error) {
      console.error('Error sending order expired email:', error);
      throw error;
    }
  }

  async sendGenericEmail(data: { to: string; subject: string; html: string }) {
    await this.transporter.sendMail({
      from: this.configService.get('MAIL_FROM'),
      to: data.to,
      subject: data.subject,
      html: data.html,
    });
  }
}