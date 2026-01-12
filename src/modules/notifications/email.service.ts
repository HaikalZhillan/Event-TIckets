import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { join } from 'path';
import * as fs from 'fs';
import { Notification } from '../../entities/notification.entity';
import {
  NotificationStatus,
  NotificationType,
} from '../../common/enums/notification.enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private isMailServerAvailable = false;

  constructor(
    @InjectRepository(Notification)
    private notificationsRepo: Repository<Notification>,
    private configService: ConfigService,
  ) {
    this.initializeTransporter();
  }

  private initializeTransporter(): void {
    const mailHost = this.configService.get<string>('MAIL_HOST') || 'localhost';
    const mailPort = parseInt(this.configService.get<string>('MAIL_PORT') || '1025');
    const mailUser = this.configService.get<string>('MAIL_USER');
    const mailPass = this.configService.get<string>('MAIL_PASS');
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    this.logger.log(`📧 Initializing mail transporter: ${mailHost}:${mailPort}`);

    if (isProduction && mailUser && mailPass) {
      this.transporter = nodemailer.createTransport({
        host: mailHost,
        port: mailPort,
        secure: mailPort === 465,
        auth: {
          user: mailUser,
          pass: mailPass,
        },
      });
    } else {
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
  }

  async onModuleInit(): Promise<void> {
    await this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.isMailServerAvailable = true;
      this.logger.log('✅ Mail server connection verified successfully');
      this.logger.log('📬 Check emails at http://localhost:8025');
    } catch (error) {
      this.isMailServerAvailable = false;
      this.logger.warn(`⚠️ Mail server not available: ${error.message}`);
      this.logger.warn('📧 Emails will be logged but not sent');
      this.logger.warn('🔧 Start Mailpit: docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit');
    }
  }

  private getFromAddress(): string {
    const fromName = this.configService.get<string>('MAIL_FROM_NAME') || 'Event Tickets';
    const fromEmail = this.configService.get<string>('MAIL_FROM') || 'noreply@eventtickets.com';
    return `"${fromName}" <${fromEmail}>`;
  }

  async sendTicketEmail(to: string, userId: string, data: any): Promise<void> {
    const subject = `Your Tickets for ${data.eventName}`;
    const htmlContent = this.loadTemplate('ticket.template.html', data);
    await this.sendEmail(to, userId, subject, htmlContent, NotificationType.EMAIL);
  }

  async sendReminderEmail(to: string, userId: string, data: any): Promise<void> {
    const subject = `Reminder: ${data.eventName} is tomorrow!`;
    const htmlContent = this.loadTemplate('reminder.template.html', data);
    await this.sendEmail(to, userId, subject, htmlContent, NotificationType.REMINDER);
  }

  async sendExpiryEmail(to: string, userId: string, data: any): Promise<void> {
    const subject = `Order Expired: ${data.eventName}`;
    const htmlContent = this.loadTemplate('expiry.template.html', data);
    await this.sendEmail(to, userId, subject, htmlContent, NotificationType.EMAIL);
  }

  async sendOrderCreatedEmail(to: string, userId: string, data: any): Promise<void> {
    const subject = `Order Confirmation: ${data.orderNumber}`;
    const htmlContent = this.loadTemplate('order-created.template.html', data);
    await this.sendEmail(to, userId, subject, htmlContent, NotificationType.EMAIL);
  }

  /**
   * Send order paid email with tickets
   */
  async sendOrderPaidEmail(data: {
    email: string;
    userName: string;
    orderNumber: string;
    invoiceNumber: string;
    eventTitle: string;
    eventLocation: string;
    eventStartTime: Date;
    quantity: number;
    totalAmount: number;
    paidAt: Date;
    paymentMethod: string;
    tickets: Array<{
      id: string;
      ticketNumber: string;
      qrCodeUrl: string;
      pdfUrl: string;
    }>;
  }): Promise<void> {
    const ticketsList = data.tickets
      .map(
        (t) => `
        <div style="border: 1px solid #e5e7eb; padding: 15px; margin: 10px 0; border-radius: 8px; background: #fff;">
          <p style="margin: 0 0 10px 0;"><strong>🎫 Ticket: ${t.ticketNumber}</strong></p>
          <p style="margin: 0;">
            <a href="${t.pdfUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin-right: 10px;">
              📄 Download PDF
            </a>
            <a href="${t.qrCodeUrl}" style="display: inline-block; background: #10B981; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px;">
              📱 View QR Code
            </a>
          </p>
        </div>
      `,
      )
      .join('');

    const eventDate = new Date(data.eventStartTime);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; background: #f3f4f6; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; }
          .header h1 { margin: 0; font-size: 28px; }
          .details { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .details h3 { margin-top: 0; color: #374151; }
          .details p { margin: 8px 0; color: #4b5563; }
          .tickets { margin: 25px 0; }
          .tickets h3 { color: #374151; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your tickets are ready</p>
          </div>
          
          <p>Dear <strong>${data.userName}</strong>,</p>
          <p>Great news! Your payment has been confirmed and your tickets are ready for download.</p>
          
          <div class="details">
            <h3>📋 Order Details</h3>
            <p><strong>Order Number:</strong> ${data.orderNumber}</p>
            <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
            <p><strong>Event:</strong> ${data.eventTitle}</p>
            <p><strong>📅 Date:</strong> ${eventDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p><strong>⏰ Time:</strong> ${eventDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
            <p><strong>📍 Location:</strong> ${data.eventLocation || 'TBA'}</p>
            <p><strong>🎟️ Quantity:</strong> ${data.quantity} ticket(s)</p>
            <p><strong>💰 Total Paid:</strong> Rp ${data.totalAmount.toLocaleString('id-ID')}</p>
            <p><strong>💳 Payment Method:</strong> ${data.paymentMethod}</p>
            <p><strong>📆 Paid At:</strong> ${new Date(data.paidAt).toLocaleString()}</p>
          </div>

          <div class="tickets">
            <h3>🎫 Your Tickets (${data.tickets.length})</h3>
            ${ticketsList}
          </div>

          <div class="footer">
            <p>📌 <strong>Important:</strong> Please download your tickets and present them (printed or on mobile) at the venue entrance.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>Thank you for your purchase! See you at the event! 🎉</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const subject = `🎫 Your Tickets for ${data.eventTitle} - Order ${data.orderNumber}`;
    
    // Use sendEmailDirect for this special case (no userId needed for order paid emails)
    await this.sendEmailDirect(data.email, subject, html);
  }

  /**
   * Direct email send without notification record (for order emails)
   */
  private async sendEmailDirect(to: string, subject: string, html: string): Promise<void> {
    if (!this.isMailServerAvailable) {
      this.logger.warn(`📧 Mail server unavailable. Email not sent:`);
      this.logger.warn(`   To: ${to}`);
      this.logger.warn(`   Subject: ${subject}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        html,
      });

      this.logger.log(`✅ Email sent to ${to}`);
      this.logger.log(`   Subject: ${subject}`);
      this.logger.log(`   Message ID: ${info.messageId}`);
      this.logger.log(`📬 View at http://localhost:8025`);
    } catch (error) {
      this.logger.error(`❌ Failed to send email to ${to}: ${error.message}`);
      await this.verifyConnection();
    }
  }

  /**
   * Send email with notification record
   */
  private async sendEmail(
    to: string,
    userId: string,
    subject: string,
    htmlContent: string,
    type: NotificationType,
  ): Promise<void> {
    const notification = this.notificationsRepo.create({
      userId,
      type,
      subject,
      message: htmlContent,
      status: NotificationStatus.QUEUED,
    });

    const savedNotification = await this.notificationsRepo.save(notification);

    if (!this.isMailServerAvailable) {
      this.logger.warn(`📧 Mail server unavailable. Email queued but not sent:`);
      this.logger.warn(`   To: ${to}`);
      this.logger.warn(`   Subject: ${subject}`);
      
      await this.notificationsRepo.update(savedNotification.id, {
        status: NotificationStatus.PENDING,
      });
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        html: htmlContent,
      });

      await this.notificationsRepo.update(savedNotification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });

      this.logger.log(`✅ Email sent to ${to}`);
      this.logger.log(`   Subject: ${subject}`);
      this.logger.log(`   Message ID: ${info.messageId}`);
      this.logger.log(`📬 View at http://localhost:8025`);
    } catch (error) {
      await this.notificationsRepo.update(savedNotification.id, {
        status: NotificationStatus.FAILED,
      });

      this.logger.error(`❌ Failed to send email to ${to}: ${error.message}`);
      await this.verifyConnection();
    }
  }

  private loadTemplate(templateName: string, data: any): string {
    const possiblePaths = [
      join(__dirname, 'templates', templateName),
      join(__dirname, '..', 'templates', templateName),
      join(process.cwd(), 'src', 'modules', 'notifications', 'templates', templateName),
      join(process.cwd(), 'dist', 'modules', 'notifications', 'templates', templateName),
    ];

    for (const templatePath of possiblePaths) {
      if (fs.existsSync(templatePath)) {
        let template = fs.readFileSync(templatePath, 'utf8');
        return this.replaceTemplateVariables(template, data);
      }
    }

    this.logger.warn(`Template not found: ${templateName}, using fallback`);
    return this.getFallbackTemplate(templateName, data);
  }

  private replaceTemplateVariables(template: string, data: any): string {
    for (const key in data) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      const value = data[key];
      template = template.replace(regex, value !== undefined ? String(value) : '');
    }
    return template;
  }

  private getFallbackTemplate(templateName: string, data: any): string {
    // ... keep existing fallback templates
    return `<html><body><h1>Notification</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
  }
}