import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(24, { message: 'El nombre no puede pasar de 24 caracteres' })
  name: string;

  @IsEmail({}, { message: 'Correo inválido' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  password: string;

  /** Edad declarada en el registro. */
  @IsOptional()
  @IsInt()
  @Min(4, { message: 'Edad inválida' })
  @Max(120, { message: 'Edad inválida' })
  age?: number;
}
