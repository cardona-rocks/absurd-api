import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';
import { StorageService } from './uploads/storage.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors();

  // Traduce errores de Mongoose y de disco a respuestas legibles en vez de
  // dejar un "Internal server error" sin explicación.
  app.useGlobalFilters(new MongoExceptionFilter());

  // Los sprites los sirve UploadsController, que lee del bucket o del disco
  // según toque; por eso aquí no se registran estáticos.

  // Comprobación real de escritura al arrancar: mejor enterarse ahora que con
  // un 500 al subir la primera imagen.
  const storage = app.get(StorageService);
  const status = await storage.describe();
  if (status.writable) {
    logger.log(
      `Imágenes: ${status.backend} en ${status.location}` +
        (status.persistent ? '' : ' (efímero: un despliegue nuevo las borra)'),
    );
  } else {
    logger.error(
      `No se puede escribir en ${status.location}: ${status.error}. ` +
        'Las subidas van a fallar. Revisa las variables S3_* o UPLOADS_DIR.',
    );
  }

  const port = Number(process.env.PORT ?? 3000);
  // Railway y similares enrutan al contenedor, hay que escuchar en todas las
  // interfaces y no solo en localhost.
  await app.listen(port, '0.0.0.0');
  logger.log(`absurd-api escuchando en el puerto ${port}`);
}

bootstrap().catch((err: unknown) => {
  // Sin esto, un fallo de arranque (por ejemplo MONGODB_URI ausente) sale como
  // una promesa rechazada sin contexto en los logs del deploy.
  const message = err instanceof Error ? err.message : String(err);
  new Logger('Bootstrap').error(`No se pudo arrancar la API: ${message}`);
  process.exit(1);
});
