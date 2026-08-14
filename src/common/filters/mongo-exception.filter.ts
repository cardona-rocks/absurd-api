import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { Error as MongooseError } from 'mongoose';

/** Error de clave duplicada de MongoDB. */
interface MongoServerError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

/** Errores de sistema de ficheros que interesa explicar. */
const FS_CODES: Record<string, string> = {
  EACCES: 'sin permisos de escritura',
  EPERM: 'sin permisos de escritura',
  EROFS: 'el sistema de ficheros es de solo lectura',
  ENOSPC: 'no queda espacio en disco',
  ENOENT: 'la carpeta de destino no existe',
};

/**
 * Convierte en respuestas legibles los errores que Nest dejaría en un
 * "Internal server error" pelado: validaciones de Mongoose, claves duplicadas
 * y fallos al escribir ficheros. Sin esto, depurar una subida fallida obliga a
 * ir a los logs del servidor.
 */
@Catch()
export class MongoExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Las excepciones HTTP ya vienen con su mensaje: se dejan pasar.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return response.status(status).json(exception.getResponse());
    }

    const { status, message } = this.translate(exception);

    // El detalle completo queda en los logs; al cliente va lo justo.
    this.logger.error(
      `${status} ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    return response.status(status).json({ statusCode: status, message });
  }

  private translate(exception: unknown): { status: number; message: string } {
    if (exception instanceof MongooseError.ValidationError) {
      const detail = Object.values(exception.errors)
        .map((e) => e.message)
        .join('. ');
      return {
        status: HttpStatus.BAD_REQUEST,
        message: detail || 'Los datos no son válidos',
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Valor inválido para "${exception.path}"`,
      };
    }

    const err = exception as MongoServerError;

    if (err?.code === 11000) {
      const field = Object.keys(err.keyValue ?? {})[0] ?? 'valor';
      return {
        status: HttpStatus.CONFLICT,
        message: `Ya existe un registro con ese ${field}`,
      };
    }

    const fsReason = err?.code ? FS_CODES[String(err.code)] : undefined;
    if (fsReason) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message:
          `No se pudo guardar el fichero: ${fsReason}. ` +
          'Revisa UPLOADS_DIR y, en Railway, que haya un volumen montado en esa ruta.',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        exception instanceof Error
          ? exception.message
          : 'Error interno del servidor',
    };
  }
}
