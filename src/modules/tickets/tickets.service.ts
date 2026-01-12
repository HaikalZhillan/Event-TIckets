//tickets.service.ts

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as QRCode from 'qrcode';
const PDFDocument = require('pdfkit');
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { Ticket, TicketStatus } from '../../entities/ticket.entity';
import { Order } from '../../entities/order.entity';
import { Event } from '../../entities/event.entity';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly uploadDir: string;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {
    this.uploadDir = process.cwd() + '/uploads';
    
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory: ${this.uploadDir}`);
    }
  }

  async generateTicketsForOrder(orderId: string): Promise<Ticket[]> {
    try {
      this.logger.log(`Creating tickets for order ${orderId}`);

      const order = await this.orderRepository.findOne({
        where: { id: orderId },
        relations: ['user', 'event'],
      });

      if (!order) {
        throw new NotFoundException(`Order with ID '${orderId}' not found`);
      }

      if (!order.user || !order.event) {
        this.logger.error(`Order ${orderId} is missing user or event relations`);
        throw new Error('Order data is incomplete');
      }

      const existingTickets = await this.ticketRepository.find({
        where: { orderId: order.id },
      });

      if (existingTickets.length > 0) {
        this.logger.log(`ℹTickets already exist for order ${orderId}`);
        return existingTickets;
      }

      const ticketsToCreate: Partial<Ticket>[] = [];

      for (let i = 0; i < order.quantity; i++) {
        const ticketNumber = this.generateTicketNumber();

        const qrCodeFileName = await this.generateQRCode(ticketNumber);

        const seatNumber = this.generateSeatNumber(i);

        const ticketData: Partial<Ticket> = {
          id: uuidv4(),
          ticketNumber,
          seatNumber,
          eventId: order.eventId,
          orderId: order.id,
          attendeeName: order.user.name || null,
          attendeeEmail: order.user.email || null,
          status: TicketStatus.ACTIVE,
          createdBy: order.userId,
          paidAt: new Date(),
          qrCodeUrl: qrCodeFileName,
        };

        ticketsToCreate.push(ticketData);
      }

      const savedTickets = await this.ticketRepository.save(
        ticketsToCreate as Ticket[],
      );

      this.logger.log(`Saved ${savedTickets.length} tickets to database`);

      const pdfPromises = savedTickets.map(async (ticket) => {
        const pdfFileName = await this.generatePDF(ticket, order);
        ticket.pdfUrl = pdfFileName;
        return ticket;
      });

      const ticketsWithPdf = await Promise.all(pdfPromises);

      const finalTickets = await this.ticketRepository.save(ticketsWithPdf);

      this.logger.log(`Successfully created ${finalTickets.length} tickets for order ${orderId}`);

      return finalTickets;
    } catch (error) {
      this.logger.error(`Failed to create tickets for order ${orderId}:`, error);
      throw error;
    }
  }

  private generateTicketNumber(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `TKT-${timestamp}-${randomPart}`.toUpperCase();
  }

  private generateSeatNumber(index: number): string {
    const section = String.fromCharCode(65 + Math.floor(index / 100));
    const row = Math.floor((index % 100) / 10) + 1;
    const seat = (index % 10) + 1;
    return `${section}${row}-${seat}`;
  }

  private async generateQRCode(ticketNumber: string): Promise<string> {
    try {
      const qrCodeFileName = `qr-${ticketNumber}.png`;
      const qrCodePath = path.join(this.uploadDir, qrCodeFileName);

      await QRCode.toFile(qrCodePath, ticketNumber, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      this.logger.log(`Generated QR code for ticket ${ticketNumber}`);
      return qrCodeFileName;
    } catch (error) {
      this.logger.error(`Failed to generate QR code for ticket ${ticketNumber}:`, error);
      throw error;
    }
  }

  private async generatePDF(ticket: Ticket, order: Order): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      try {
        const pdfFileName = `ticket-${ticket.ticketNumber}.pdf`;
        const pdfPath = path.join(this.uploadDir, pdfFileName);

        const doc = new PDFDocument({
          size: 'A5',
          layout: 'landscape',
          margin: 30,
        });

        const stream = fs.createWriteStream(pdfPath);
        doc.pipe(stream);

        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f9fa');

        doc.fillColor('#4F46E5')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text('EVENT TICKET', { align: 'center' });
        
        doc.moveDown();
        
        // Ticket info
        doc.fontSize(14)
           .fillColor('#1F2937')
           .text(`Event: ${(order.event as any)?.title || 'N/A'}`);
        
        const eventStartTime = (order.event as any)?.startTime || (order.event as any)?.eventDate;
        if (eventStartTime) {
          doc.text(`Date: ${new Date(eventStartTime).toLocaleDateString()}`);
          doc.text(`Time: ${new Date(eventStartTime).toLocaleTimeString()}`);
        }
        
        doc.text(`Location: ${(order.event as any)?.location || 'TBA'}`);
        doc.moveDown();
        doc.text(`Ticket Number: ${ticket.ticketNumber}`);
        doc.text(`Seat: ${ticket.seatNumber}`);
        doc.text(`Attendee: ${ticket.attendeeName || 'Guest'}`);
        doc.moveDown();

        // Add QR code
        const qrCodePath = path.join(this.uploadDir, ticket.qrCodeUrl);
        if (fs.existsSync(qrCodePath)) {
          doc.image(qrCodePath, {
            fit: [150, 150],
            align: 'center',
          });
        }

        doc.end();

        stream.on('finish', () => {
          this.logger.log(`Generated PDF for ticket ${ticket.ticketNumber}`);
          resolve(pdfFileName);
        });

        stream.on('error', (error) => {
          this.logger.error(`Failed to write PDF for ticket ${ticket.ticketNumber}:`, error);
          reject(error);
        });
      } catch (error) {
        this.logger.error(`Failed to generate PDF for ticket ${ticket.ticketNumber}:`, error);
        reject(error);
      }
    });
  }

  async getTicketsByOrderId(orderId: string, userId?: string): Promise<Ticket[]> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['tickets'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID '${orderId}' not found`);
    }

    if (userId && order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view these tickets');
    }

    return order.tickets || [];
  }

  async getTicketById(ticketId: string, userId?: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['order', 'order.user', 'event'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID '${ticketId}' not found`);
    }

    if (userId && ticket.order.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this ticket');
    }

    return ticket;
  }

  async validateTicket(ticketId: string): Promise<{
    valid: boolean;
    ticket?: any;
    message: string;
  }> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['order', 'order.user', 'event'],
    });

    if (!ticket) {
      return { valid: false, message: 'Ticket not found' };
    }

    if (ticket.status !== TicketStatus.ACTIVE) {
      return {
        valid: false,
        ticket: { ticketNumber: ticket.ticketNumber, status: ticket.status },
        message: `Ticket is ${ticket.status}`,
      };
    }

    if (ticket.checkedIn) {
      return {
        valid: false,
        ticket: { ticketNumber: ticket.ticketNumber, checkedInAt: ticket.checkedInAt },
        message: 'Ticket has already been used',
      };
    }

    return {
      valid: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        seatNumber: ticket.seatNumber,
        attendeeName: ticket.attendeeName,
        eventTitle: (ticket.event as any)?.title,
        eventLocation: (ticket.event as any)?.location,
      },
      message: 'Ticket is valid',
    };
  }

  async checkInTicket(ticketId: string, checkedInBy: string): Promise<Ticket> {
    const validation = await this.validateTicket(ticketId);

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    ticket.checkedIn = true;
    ticket.checkedInAt = new Date();
    ticket.checkedInBy = checkedInBy;
    ticket.status = TicketStatus.USED;

    const savedTicket = await this.ticketRepository.save(ticket);
    this.logger.log(`Ticket ${ticket.ticketNumber} checked in`);

    return savedTicket;
  }

  async batchCancelTickets(ticketIds: string[], reason: string): Promise<void> {
    if (!ticketIds || ticketIds.length === 0) return;

    await this.ticketRepository.update(
      { id: In(ticketIds) },
      {
        status: TicketStatus.CANCELLED,
        cancelledAt: new Date(),
        notes: reason,
      },
    );

    this.logger.log(`Cancelled ${ticketIds.length} tickets: ${reason}`);
  }

  async downloadTicket(ticketId: string, userId: string): Promise<string> {
    const ticket = await this.getTicketById(ticketId, userId);

    if (!ticket.pdfUrl) {
      const order = await this.orderRepository.findOne({
        where: { id: ticket.orderId },
        relations: ['user', 'event'],
      });

      const pdfFileName = await this.generatePDF(ticket, order);
      await this.ticketRepository.update(ticket.id, { pdfUrl: pdfFileName });
      return pdfFileName;
    }

    return ticket.pdfUrl;
  }

  async regenerateTicket(ticketId: string, userId: string): Promise<Ticket> {
    const ticket = await this.getTicketById(ticketId, userId);

    const order = await this.orderRepository.findOne({
      where: { id: ticket.orderId },
      relations: ['user', 'event'],
    });

    const qrCodeFileName = await this.generateQRCode(ticket.ticketNumber);
    const pdfFileName = await this.generatePDF(ticket, order);

    await this.ticketRepository.update(ticket.id, { 
      qrCodeUrl: qrCodeFileName, 
      pdfUrl: pdfFileName 
    });

    ticket.qrCodeUrl = qrCodeFileName;
    ticket.pdfUrl = pdfFileName;

    this.logger.log(`Regenerated ticket: ${ticket.ticketNumber}`);
    return ticket;
  }
}