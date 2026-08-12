import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join, resolve } from 'path';

/**
 * Almacenamiento de imágenes en disco.
 *
 * En Railway hay que montar un volumen persistente y apuntar UPLOADS_DIR a su
 * ruta (por ejemplo /data). Sin volumen los ficheros se pierden en cada deploy,
 * porque el sistema de archivos del contenedor es efímero.
 */
export const UPLOADS_ROOT = resolve(process.env.UPLOADS_DIR ?? './uploads');

/** Subcarpeta de sprites de avatar. */
export const AVATARS_DIR = join(UPLOADS_ROOT, 'avatars');

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

/** Crea las carpetas si no existen. Se llama al arrancar. */
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

/** URL pública de un fichero de sprite. */
export function avatarFileUrl(filename: string): string {
  return `${UPLOADS_PUBLIC_PATH}/avatars/${filename}`;
}
