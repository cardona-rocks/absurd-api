import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Cuerpo que envía la app nativa tras Sign in with Apple. */
export class AppleSignInDto {
  /** JWT de identidad emitido por Apple. */
  @IsString()
  @MinLength(1)
  identityToken: string;

  /**
   * Nonce en claro que la app pasó a Apple. El token trae el SHA-256;
   * lo comprobamos para evitar reinyecciones.
   */
  @IsString()
  @MinLength(8)
  nonce: string;

  /** Nombre (solo llega la primera vez que el usuario autoriza). */
  @IsOptional()
  @IsString()
  @MaxLength(48)
  fullName?: string;
}
