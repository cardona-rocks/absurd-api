import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { extname, join, resolve } from 'path';
import type { S3Config } from './s3-client';

/**
 * Almacenamiento de imágenes.
 *
 * Si están definidas las variables S3_* se usa un bucket compatible con S3 (el
 * de Railway, por ejemplo). Si no, se guarda en disco bajo UPLOADS_DIR, que
 * sirve para desarrollo pero es efímero en un contenedor.
 */
export const UPLOADS_ROOT = resolve(process.env.UPLOADS_DIR ?? './uploads');

/** Subcarpeta (y prefijo de clave en el bucket) de los sprites. */
export const AVATARS_DIR = join(UPLOADS_ROOT, 'avatars');
export const AVATARS_PREFIX = 'avatars';

/** Prefijo público con el que se sirven. */
export const UPLOADS_PUBLIC_PATH = '/uploads';

export const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

export const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

/** Configuración del bucket, o null si no está definida. */
export function s3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: process.env.S3_REGION?.trim() || 'auto',
  };
}

export const isS3Enabled = (): boolean => s3Config() !== null;

/** Crea las carpetas locales si no existen. Solo aplica en modo disco. */
export function ensureUploadDirs(): void {
  for (const dir of [UPLOADS_ROOT, AVATARS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }
}

/**
 * Nombre de fichero seguro y sin colisiones. No se conserva el nombre original
 * porque puede traer rutas o caracteres raros.
 */
export function safeFilename(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  const safeExt = ALLOWED_EXT.includes(ext) ? ext : '.png';
  return `${Date.now()}-${randomBytes(6).toString('hex')}${safeExt}`;
}

/** Ruta pública de un sprite, la misma la sirva el bucket o el disco. */
export function avatarFileUrl(filename: string): string {
  return `${UPLOADS_PUBLIC_PATH}/${AVATARS_PREFIX}/${filename}`;
}

/** Comprueba que se puede escribir en disco creando y borrando un fichero. */
export function checkDiskWritable(): { writable: boolean; error: string | null } {
  try {
    ensureUploadDirs();
    const probe = join(AVATARS_DIR, `.write-test-${Date.now()}`);
    writeFileSync(probe, 'ok');
    unlinkSync(probe);
    return { writable: true, error: null };
  } catch (e) {
    return { writable: false, error: e instanceof Error ? e.message : String(e) };
  }
}
