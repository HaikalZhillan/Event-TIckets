import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private isMailServerAvailable = false;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const mailHost = this.configService.get<string>('MAIL_HOST') || 'localhost';
    const mailPort = parseInt(this.configService.get<string>('MAIL_PORT') || '1025');

    this.logger.log(`📧 Initializing MailService: ${mailHost}:${mailPort}`);

    this.transporter = nodemailer.createTransport({
      host: mailHost,
      port: mailPort,
      secure: false,
      ignoreTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
    } as nodemailer.TransportOptions);
  }

  async onModuleInit() {
    await this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.isMailServerAvailable = true;
      this.logger.log('✅ MailService connected successfully');
      this.logger.log('📬 Mailpit: http://localhost:8025');
    } catch (error) {
      this.isMailServerAvailable = false;
      this.logger.warn(`⚠️ Mail server unavailable: ${error.message}`);
      this.logger.warn('🔧 Start Mailpit: docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit');
    }
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
    if (!this.isMailServerAvailable) {
      this.logger.warn('📧 Mail server unavailable, email not sent');
      return;
    }

    const { email, userName, orderNumber, invoiceNumber, eventTitle, quantity, totalAmount, expiredAt, paymentUrl } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM') || 'noreply@eventtickets.com',
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
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Order created email sent to ${email}`);
      this.logger.log(`   Message ID: ${info.messageId}`);
      this.logger.log(`📬 View at http://localhost:8025`);
    } catch (error) {
      this.logger.error(`❌ Failed to send order created email: ${error.message}`);
      await this.verifyConnection();
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
    if (!this.isMailServerAvailable) {
      this.logger.warn('📧 Mail server unavailable, email not sent');
      return;
    }

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

    // Build base URL for file access
    const baseUrl = this.configService.get('BASE_URL') || 'http://localhost:3000';

    const ticketsList = tickets && tickets.length > 0 ? tickets.map(ticket => `
      <div class="ticket-item" style="margin-bottom:20px; border:1px solid #e5e7eb; padding:15px; border-radius:8px; background:#fff;">
        <div style="font-weight:bold; margin-bottom:10px;">🎫 Ticket: ${ticket.ticketNumber}</div>
        ${ticket.seatNumber ? `<div style="margin-bottom:10px;">💺 Seat: ${ticket.seatNumber}</div>` : ''}
        
        ${ticket.qrCodeUrl ? `
          <div style="margin:15px 0; text-align:center;">
            <img 
              src="${baseUrl}/uploads/${ticket.qrCodeUrl}" 
              alt="QR Code"
              width="150"
              style="border:2px solid #4F46E5; padding:5px; border-radius:8px;"
            />
          </div>
        ` : ''}
        
        ${ticket.pdfUrl ? `
          <div style="text-align:center; margin-top:10px;">
            <a 
              href="${baseUrl}/uploads/${ticket.pdfUrl}" 
              target="_blank"
              style="
                display:inline-block;
                background:#10b981;
                color:#fff;
                padding:10px 20px;
                border-radius:6px;
                text-decoration:none;
                font-weight:bold;
              "
            >
              📄 Download Ticket PDF
            </a>
          </div>
        ` : ''}
      </div>
    `).join('') : '';

    const mailOptions = {
      from: this.configService.get('MAIL_FROM') || 'noreply@eventtickets.com',
      to: email,
      subject: `🎫 Your Tickets for ${eventTitle} - Order ${orderNumber}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background-color: #f9fafb; padding: 30px; }
            .success-badge { font-size: 3em; margin-bottom: 10px; }
            .order-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .detail-label { font-weight: bold; color: #6b7280; }
            .detail-value { color: #111827; }
            .total { font-size: 1.2em; font-weight: bold; color: #10b981; }
            .success-box { background-color: #d1fae5; padding: 15px; margin: 20px 0; border-left: 4px solid #10b981; border-radius: 4px; }
            .event-info { background-color: #e0e7ff; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .tickets-section { margin: 25px 0; }
            .footer { text-align: center; color: #6b7280; font-size: 0.9em; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-badge">✅</div>
              <h1>Payment Confirmed!</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your tickets are ready</p>
            </div>
            <div class="content">
              <p>Dear <strong>${userName}</strong>,</p>
              <p>Great news! Your payment has been confirmed and your tickets are ready for download.</p>
              
              <div class="success-box">
                <strong>✅ Payment Status: PAID</strong><br>
                💳 Paid on: ${new Date(paidAt).toLocaleString('id-ID', { 
                  dateStyle: 'full', 
                  timeStyle: 'short' 
                })}<br>
                💰 Payment Method: ${paymentMethod}
              </div>

              <div class="order-details">
                <h2>📋 Order Details</h2>
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
                <h2>🎉 Event Information</h2>
                <p style="font-size:18px; font-weight:bold; margin:10px 0;">${eventTitle}</p>
                <p><strong>📅 Date:</strong> ${new Date(eventStartTime).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
                <p><strong>⏰ Time:</strong> ${new Date(eventStartTime).toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</p>
                ${eventLocation ? `<p><strong>📍 Location:</strong> ${eventLocation}</p>` : ''}
              </div>

              ${tickets && tickets.length > 0 ? `
                <div class="tickets-section">
                  <h2>🎫 Your Tickets (${tickets.length})</h2>
                  <p style="color:#6b7280; margin-bottom:15px;">Please download and save your tickets. Present them at the venue entrance.</p>
                  ${ticketsList}
                </div>
              ` : ''}

              <div style="background:#fef3c7; padding:15px; border-radius:8px; margin:20px 0;">
                <p style="margin:0;"><strong>📌 Important:</strong></p>
                <ul style="margin:10px 0; padding-left:20px;">
                  <li>Download your tickets before the event</li>
                  <li>You can present them printed or on your mobile device</li>
                  <li>Arrive early to avoid queues</li>
                </ul>
              </div>

              <p>If you have any questions, please contact our support team.</p>
              <p><strong>See you at the event! 🎉</strong></p>
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
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Payment confirmation email sent to ${email}`);
      this.logger.log(`   Subject: 🎫 Your Tickets for ${eventTitle}`);
      this.logger.log(`   Tickets: ${tickets?.length || 0} tickets`);
      this.logger.log(`   Message ID: ${info.messageId}`);
      this.logger.log(`📬 View at http://localhost:8025`);
    } catch (error) {
      this.logger.error(`❌ Failed to send payment confirmation email: ${error.message}`);
      this.logger.error(error.stack);
      await this.verifyConnection();
    }
  }

  async sendOrderCancelledEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    eventTitle: string;
    cancelledAt: Date;
  }) {
    if (!this.isMailServerAvailable) {
      this.logger.warn('📧 Mail server unavailable, email not sent');
      return;
    }

    const { email, userName, orderNumber, eventTitle, cancelledAt } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM') || 'noreply@eventtickets.com',
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
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Order cancelled email sent to ${email}`);
      this.logger.log(`📬 View at http://localhost:8025`);
    } catch (error) {
      this.logger.error(`❌ Failed to send order cancelled email: ${error.message}`);
      await this.verifyConnection();
    }
  }

  async sendOrderExpiredEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    eventTitle: string;
  }) {
    if (!this.isMailServerAvailable) {
      this.logger.warn('📧 Mail server unavailable, email not sent');
      return;
    }

    const { email, userName, orderNumber, eventTitle } = data;

    const mailOptions = {
      from: this.configService.get('MAIL_FROM') || 'noreply@eventtickets.com',
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
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`✅ Order expired email sent to ${email}`);
      this.logger.log(`📬 View at http://localhost:8025`);
    } catch (error) {
      this.logger.error(`❌ Failed to send order expired email: ${error.message}`);
      await this.verifyConnection();
    }
  }
}