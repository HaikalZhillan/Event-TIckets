import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('uploads')
export class UploadsController {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  @Public()
  @Get(':filename')
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Security: prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new NotFoundException('File not found');
    }

    const filePath = join(this.uploadDir, filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }

    // Set appropriate content type
    if (filename.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (filename.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    }

    // Send file
    res.sendFile(filePath);
  }
}