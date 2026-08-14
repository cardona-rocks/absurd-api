import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { S3Client } from './s3-client';
import {
  AVATARS_DIR,
  AVATARS_PREFIX,
  checkDiskWritable,
  isS3Enabled,
  s3Config,
} from './uploads.config';

export interface StorageStatus {
  backend: 'bucket' | 'disco';
  /** Bucket o carpeta, según el modo. */
  location: string;
  writable: boolean;
  error: string | null;
  /** True si los ficheros sobreviven a un despliegue. */
  persistent: boolean;
}

/**
 * Guarda y sirve las imágenes, en el bucket o en disco.
 *
 * El resto de la aplicación no sabe cuál está activo: siempre maneja nombres de
 * fichero y rutas `/uploads/avatars/…`, así que cambiar de modo no obliga a
 * migrar lo que ya está guardado en la base de datos.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3: S3Client | null;

  constructor() {
    const config = s3Config();
    this.s3 = config ? new S3Client(config) : null;

    if (this.s3) {
      this.logger.log(`Imágenes en el bucket "${config!.bucket}" (${config!.endpoint})`);
    } else {
      this.logger.warn(
        `Imágenes en disco (${AVATARS_DIR}). Sin variables S3_*, un despliegue nuevo se las lleva por delante.`,
      );
    }
  }

  get usingBucket(): boolean {
    return this.s3 !== null;
  }

  private key(filename: string): string {
    return `${AVATARS_PREFIX}/${filename}`;
  }

  /** Guarda el contenido y devuelve el nombre con el que quedó. */
  async save(
    filename: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    if (this.s3) {
      await this.s3.put(this.key(filename), body, contentType);
      return;
    }
    await fs.mkdir(AVATARS_DIR, { recursive: true });
    await fs.writeFile(join(AVATARS_DIR, filename), body);
  }

  /** Lee un sprite para servirlo. Devuelve null si no existe. */
  async read(
    filename: string,
  ): Promise<{ body: Buffer; contentType: string } | null> {
    // Un nombre manipulado no debe poder salirse de la carpeta ni del prefijo.
    if (!this.isSafeName(filename)) return null;

    if (this.s3) return this.s3.get(this.key(filename));

    try {
      return {
        body: await fs.readFile(join(AVATARS_DIR, filename)),
        contentType: this.contentTypeOf(filename),
      };
    } catch {
      return null;
    }
  }

  /** Borra un sprite. No falla si ya no está. */
  async remove(filename?: string | null): Promise<void> {
    if (!filename || !this.isSafeName(filename)) return;

    if (this.s3) {
      await this.s3.delete(this.key(filename)).catch((e: Error) => {
        this.logger.warn(`No se pudo borrar "${filename}": ${e.message}`);
      });
      return;
    }

    try {
      await fs.unlink(join(AVATARS_DIR, filename));
    } catch {
      // Ya no existía.
    }
  }

  /** Estado del almacenamiento, para el diagnóstico del panel. */
  async describe(): Promise<StorageStatus> {
    const config = s3Config();

    if (this.s3 && config) {
      try {
        await this.s3.check();
        return {
          backend: 'bucket',
          location: `${config.endpoint}/${config.bucket}`,
          writable: true,
          error: null,
          persistent: true,
        };
      } catch (e) {
        return {
          backend: 'bucket',
          location: `${config.endpoint}/${config.bucket}`,
          writable: false,
          error: e instanceof Error ? e.message : String(e),
          persistent: true,
        };
      }
    }

    const disk = checkDiskWritable();
    return {
      backend: 'disco',
      location: AVATARS_DIR,
      writable: disk.writable,
      error: disk.error,
      persistent: Boolean(process.env.UPLOADS_DIR),
    };
  }

  private isSafeName(name: string): boolean {
    return !name.includes('/') && !name.includes('\\') && !name.includes('..');
  }

  private contentTypeOf(filename: string): string {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}

export { isS3Enabled };
