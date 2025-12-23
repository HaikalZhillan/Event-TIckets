import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService, NotificationType } from '../notifications.service';
import { GenericMailService } from 'src/mail/generic-mail.service';

@Injectable()
export class NotificationsCron {
  private readonly logger = new Logger(NotificationsCron.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly genericMail: GenericMailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingEmails() {
    const pending = await this.notificationsService.getPendingScheduledDue(
      new Date(),
    );
    if (!pending || pending.length === 0) return;

    for (const n of pending) {
      try {
        if (n.type !== NotificationType.EMAIL) continue;

        const payload =
          typeof n.payload === 'string'
            ? this.safeJsonParse(n.payload)
            : (n.payload ?? {});

        const html = this.buildHtml(n.subject, n.message, payload);

        await this.genericMail.send({
          to: n.user?.email,
          subject: n.subject,
          html,
        });

        await this.notificationsService.markAsSent(n.id);
      } catch (e: any) {
        this.logger.error(
          `Failed sending notification ${n?.id}`,
          e?.stack || e,
        );
        try {
          await this.notificationsService.markAsFailed(n.id);
        } catch (err: any) {
          this.logger.error(
            `Failed markAsFailed for notification ${n?.id}`,
            err?.stack || err,
          );
        }
      }
    }
  }

  private safeJsonParse(raw: string): any {
    try {
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private buildHtml(subject: string, message: string, payload: any) {
    const eventInfo =
      payload?.eventTitle && payload?.eventStartTime
        ? `<p><b>Event:</b> ${payload.eventTitle}<br/>
           <b>Start:</b> ${new Date(payload.eventStartTime).toLocaleString(
             'id-ID',
           )}</p>`
        : '';

    const paymentLink = payload?.paymentUrl
      ? `<p><a href="${payload.paymentUrl}">Pay Now</a></p>`
      : '';

    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>${subject}</h2>
        <p>${message}</p>
        ${eventInfo}
        ${paymentLink}
      </div>
    `;
  }
}
