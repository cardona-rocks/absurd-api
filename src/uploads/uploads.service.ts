import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { AVATARS_DIR, ALLOWED_MIME, avatarFileUrl } from './uploads.config';

/** Lo que multer deja en cada fichero subido. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  filename: string;
  path: string;
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

  /**
   * Convierte los ficheros de multer en descriptores para guardar en el avatar.
   * Si alguno tiene un tipo no permitido se borra del disco y se rechaza todo.
   */
  async register(files: UploadedFile[]): Promise<StoredImage[]> {
    if (!files?.length) {
      throw new BadRequestException('No llegó ninguna imagen');
    }

    const invalid = files.filter((f) => !ALLOWED_MIME.includes(f.mimetype));
    if (invalid.length) {
      await Promise.all(files.map((f) => this.removeByFilename(f.filename)));
      throw new BadRequestException(
        `Formato no permitido: ${invalid.map((f) => f.mimetype).join(', ')}. Usa PNG, JPG, WEBP o GIF.`,
      );
    }

    return Promise.all(
      files.map(async (f) => {
        const { width, height } = await this.readDimensions(f.path);
        return {
          url: avatarFileUrl(f.filename),
          filename: f.filename,
          size: f.size,
          width,
          height,
        };
      }),
    );
  }

  /** Borra un fichero de sprite. No falla si ya no está. */
  async removeByFilename(filename?: string | null): Promise<void> {
    if (!filename) return;
    // Evita que un nombre manipulado se salga de la carpeta de subidas.
    if (filename.includes('/') || filename.includes('..')) return;
    try {
      await fs.unlink(join(AVATARS_DIR, filename));
    } catch {
      // Ya no existía: nada que hacer.
    }
  }

  /**
   * Lee el ancho y alto de la imagen de la cabecera del fichero.
   *
   * Se hace a mano para no añadir una dependencia de procesado de imagen; si el
   * formato no se reconoce devolvemos 0 y el panel simplemente no muestra el
   * tamaño.
   */
  private async readDimensions(
    path: string,
  ): Promise<{ width: number; height: number }> {
    try {
      const handle = await fs.open(path, 'r');
      const buffer = Buffer.alloc(32);
      await handle.read(buffer, 0, 32, 0);
      await handle.close();

      // PNG: ancho y alto van en el chunk IHDR, big-endian.
      if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
        return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
      }
      // GIF: little-endian justo tras la firma.
      if (buffer.subarray(0, 3).toString('ascii') === 'GIF') {
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
