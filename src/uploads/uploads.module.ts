import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { StorageService } from './storage.service';
import {
  AVATARS_DIR,
  MAX_FILE_SIZE,
  ensureUploadDirs,
  isS3Enabled,
  safeFilename,
} from './uploads.config';

/**
 * Con bucket, multer deja el fichero en memoria y de ahí se sube; sin bucket,
 * lo escribe directamente en disco. En modo bucket no se toca el sistema de
 * ficheros, que es justo lo que hacía fallar el despliegue sin volumen.
 */
const storage = isS3Enabled()
  ? memoryStorage()
  : (ensureUploadDirs(),
    diskStorage({
      destination: AVATARS_DIR,
      filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
    }));

@Module({
  imports: [
    MulterModule.register({
      storage,
      limits: { fileSize: MAX_FILE_SIZE, files: 12 },
    }),
  ],
  controllers: [UploadsController],
  providers: [UploadsService, StorageService],
  exports: [UploadsService, StorageService, MulterModule],
})
export class UploadsModule {}
