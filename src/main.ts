import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors();

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
