import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { StorageService } from './storage.service';

/**
 * Sirve los sprites subidos.
 *
 * Va por la API en vez de dar la URL del bucket directamente, así funciona
 * igual con buckets privados y la ruta guardada en la base de datos no cambia
 * si mañana se cambia de proveedor.
 */
@Controller('uploads/avatars')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get(':filename')
  async serve(@Param('filename') filename: string, @Res() res: Response) {
    const file = await this.storage.read(filename);
    if (!file) throw new NotFoundException('Imagen no encontrada');

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.body.length));
    // Los nombres llevan marca de tiempo y sufijo aleatorio: nunca se reutilizan.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(file.body);
  }
}
