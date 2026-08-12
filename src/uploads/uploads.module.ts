import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { UploadsService } from './uploads.service';
import {
  AVATARS_DIR,
  MAX_FILE_SIZE,
  ensureUploadDirs,
  safeFilename,
} from './uploads.config';

// Las carpetas tienen que existir antes de que multer intente escribir.
ensureUploadDirs();

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: AVATARS_DIR,
        filename: (_req, file, cb) => cb(null, safeFilename(file.originalname)),
      }),
      limits: { fileSize: MAX_FILE_SIZE, files: 12 },
    }),
  ],
  providers: [UploadsService],
  exports: [UploadsService, MulterModule],
})
export class UploadsModule {}
