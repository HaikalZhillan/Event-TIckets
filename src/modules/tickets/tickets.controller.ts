import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Res,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { join } from 'path';
import { createReadStream, existsSync } from 'fs';
import { ValidateTicketDto } from './dto/validate-ticket.dto';
import { BulkCheckInDto } from './dto/bulk-check-in.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  @Get('order/:orderId')
  @HttpCode(HttpStatus.OK)
  async getTicketsByOrder(@Param('orderId') orderId: string, @CurrentUser() user: any) {
    const tickets = await this.ticketsService.getTicketsByOrderId(orderId, user.id, user.roleName);

    return {
      success: true,
      message: `Retrieved ${tickets.length} ticket(s)`,
      data: tickets,
      count: tickets.length,
    };
  }

  @Post('generate/:orderId')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async generateTickets(@Param('orderId') orderId: string) {
    const tickets = await this.ticketsService.generateTicketsForOrder(orderId);
    return {
      success: true,
      message: `Successfully generated ${tickets.length} ticket(s)`,
      data: tickets,
      count: tickets.length,
    };
  }

  @Get(':ticketId/download')
  @HttpCode(HttpStatus.OK)
  async downloadTicket(
    @Param('ticketId') ticketId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const downloadInfo = await this.ticketsService.downloadTicket(ticketId, user.id, user.roleName);

    const fullPath = join(process.cwd(), downloadInfo.filePath);

    if (!existsSync(fullPath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Ticket file not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.fileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const fileStream = createReadStream(fullPath);
    fileStream.pipe(res);
  }

  @Post('validate')
  @Roles('admin', 'event-organizer')
  @HttpCode(HttpStatus.OK)
  async validateTicket(@Body() body: ValidateTicketDto) {
    const result = await this.ticketsService.validateTicket(body.ticketId);
    return { success: result.valid, message: result.message, data: result.ticket };
  }

  @Post(':ticketId/check-in')
  @Roles('admin', 'event-organizer')
  @HttpCode(HttpStatus.OK)
  async checkInTicket(@Param('ticketId') ticketId: string, @CurrentUser() user: any) {
    const result = await this.ticketsService.checkInTicket(ticketId, user.id);
    return { success: true, message: result.message, data: result.ticket };
  }

}
