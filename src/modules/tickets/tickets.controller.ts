import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Res,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tickets for an order' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async getTicketsByOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @CurrentUser() user: User,
  ) {
    const tickets = await this.ticketsService.getTicketsByOrderId(orderId, user.id);
    return {
      message: 'Tickets retrieved successfully',
      data: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        seatNumber: ticket.seatNumber,
        status: ticket.status,
        qrCodeUrl: ticket.qrCodeUrl,
        pdfUrl: ticket.pdfUrl,
        checkedIn: ticket.checkedIn,
        checkedInAt: ticket.checkedInAt,
      })),
    };
  }

  @Get(':ticketId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get ticket by ID' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket retrieved successfully' })
  async getTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: User,
  ) {
    const ticket = await this.ticketsService.getTicketById(ticketId, user.id);
    return {
      message: 'Ticket retrieved successfully',
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        seatNumber: ticket.seatNumber,
        status: ticket.status,
        attendeeName: ticket.attendeeName,
        attendeeEmail: ticket.attendeeEmail,
        qrCodeUrl: ticket.qrCodeUrl,
        pdfUrl: ticket.pdfUrl,
        checkedIn: ticket.checkedIn,
        checkedInAt: ticket.checkedInAt,
        event: {
          id: ticket.event?.id,
          title: (ticket.event as any)?.title,
          location: (ticket.event as any)?.location,
          startTime: (ticket.event as any)?.startTime,
        },
      },
    };
  }

  @Post('generate/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate tickets for an order (Admin only)' })
  @ApiParam({ name: 'orderId', description: 'Order ID' })
  @ApiResponse({ status: 201, description: 'Tickets generated successfully' })
  async generateTickets(
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    const tickets = await this.ticketsService.generateTicketsForOrder(orderId);
    return {
      message: 'Tickets generated successfully',
      data: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        seatNumber: ticket.seatNumber,
        qrCodeUrl: ticket.qrCodeUrl,
        pdfUrl: ticket.pdfUrl,
      })),
    };
  }

  @Get(':ticketId/download')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Download ticket PDF' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'PDF file' })
  async downloadTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const pdfUrl = await this.ticketsService.downloadTicket(ticketId, user.id);
    
    // Extract file path from URL
    const urlPath = new URL(pdfUrl).pathname;
    const filePath = path.join(process.cwd(), urlPath);

    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        message: 'PDF file not found',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${ticketId}.pdf"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  @Post(':ticketId/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate ticket QR code and PDF' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket regenerated successfully' })
  async regenerateTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: User,
  ) {
    const ticket = await this.ticketsService.regenerateTicket(ticketId, user.id);
    return {
      message: 'Ticket regenerated successfully',
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        qrCodeUrl: ticket.qrCodeUrl,
        pdfUrl: ticket.pdfUrl,
      },
    };
  }

  @Post('validate/:ticketId')
  @Public()
  @ApiOperation({ summary: 'Validate a ticket (Public endpoint for scanning)' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  async validateTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    const result = await this.ticketsService.validateTicket(ticketId);
    return result;
  }

  @Post(':ticketId/check-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'staff')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check in a ticket (Admin/Staff only)' })
  @ApiParam({ name: 'ticketId', description: 'Ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket checked in successfully' })
  async checkInTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser() user: User,
  ) {
    const ticket = await this.ticketsService.checkInTicket(ticketId, user.id);
    return {
      message: 'Ticket checked in successfully',
      data: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        seatNumber: ticket.seatNumber,
        checkedIn: ticket.checkedIn,
        checkedInAt: ticket.checkedInAt,
        status: ticket.status,
      },
    };
  }
}