import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { StorageService } from './storage.service';
import { ALLOWED_MIME, avatarFileUrl, safeFilename } from './uploads.config';

/**
 * Fichero recibido por multer. En modo bucket viene en memoria (`buffer`); en
 * modo disco, escrito ya en `path`.
 */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  filename?: string;
  path?: string;
  buffer?: Buffer;
}

export interface StoredImage {
  url: string;
  filename: string;
  size: number;
  width: number;
  height: number;
}

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly storage: StorageService) {}

  /**
   * Guarda los ficheros subidos y devuelve los descriptores para el avatar.
   * Si alguno tiene un tipo no permitido se rechaza el lote entero.
   */
  async register(files: UploadedFile[]): Promise<StoredImage[]> {
    if (!files?.length) {
      throw new BadRequestException('No llegó ninguna imagen');
    }

    const invalid = files.filter((f) => !ALLOWED_MIME.includes(f.mimetype));
    if (invalid.length) {
      // En modo disco multer ya escribió: hay que limpiar lo que no vale.
      await Promise.all(files.map((f) => this.discard(f)));
      throw new BadRequestException(
        `Formato no permitido: ${invalid.map((f) => f.mimetype).join(', ')}. Usa PNG, JPG, WEBP o GIF.`,
      );
    }

    const stored: StoredImage[] = [];
    try {
      for (const file of files) {
        const body = await this.bodyOf(file);
        const filename = file.filename ?? safeFilename(file.originalname);

        // En modo disco multer ya lo dejó escrito con ese nombre.
        if (!file.path) {
          await this.storage.save(filename, body, file.mimetype);
        }

        stored.push({
          url: avatarFileUrl(filename),
          filename,
          size: file.size,
          ...this.readDimensions(body),
        });
      }
    } catch (e) {
      // Si falla a mitad, no dejamos medias subidas por ahí.
      await Promise.all(stored.map((s) => this.storage.remove(s.filename)));
      throw e;
    }

    return stored;
  }

  /** Borra un sprite del almacenamiento activo. */
  async removeByFilename(filename?: string | null): Promise<void> {
    return this.storage.remove(filename);
  }

  /** Contenido del fichero, venga de memoria o de disco. */
  private async bodyOf(file: UploadedFile): Promise<Buffer> {
    if (file.buffer) return file.buffer;
    if (file.path) return fs.readFile(file.path);
    throw new BadRequestException('El fichero llegó vacío');
  }

  /** Limpia un fichero temporal que multer dejó en disco. */
  private async discard(file: UploadedFile): Promise<void> {
    if (!file.path) return;
    await fs.unlink(file.path).catch(() => {});
  }

  /**
   * Lee ancho y alto de la cabecera del fichero.
   *
   * Se hace a mano para no añadir una dependencia de procesado de imagen; si el
   * formato no se reconoce devolvemos 0 y el panel no muestra el tamaño.
   */
  private readDimensions(buffer: Buffer): { width: number; height: number } {
    try {
      // PNG: ancho y alto en el chunk IHDR, big-endian.
      if (buffer.length >= 24 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
      }
      // GIF: little-endian justo tras la firma.
      if (buffer.length >= 10 && buffer.subarray(0, 3).toString('ascii') === 'GIF') {
        return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
      }
      // JPEG y WEBP requieren recorrer segmentos; no compensa aquí.
      return { width: 0, height: 0 };
    } catch (e) {
      this.logger.warn(`No se pudieron leer las dimensiones: ${(e as Error).message}`);
      return { width: 0, height: 0 };
    }
  }
}
