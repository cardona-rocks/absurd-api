import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';

/** Nombres de invitado, en tono absurdo. */
const GUEST_NAMES = [
  'Anónimo Furioso',
  'Rival Misterioso',
  'Don Nadie',
  'Ente Indeciso',
  'Sujeto Sospechoso',
  'Fulano Absurdo',
];

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  private async issue(user: UserDocument) {
    await this.usersService.touchLoginStreak(user._id.toString());
    const fresh = await this.usersService.getOrThrow(user._id.toString());
    return {
      access_token: this.jwtService.sign({
        sub: fresh._id.toString(),
        email: fresh.email,
      }),
      user: this.usersService.toResponse(fresh),
    };
  }

  async signUp(dto: SignUpDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Ese correo ya está registrado');
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      age: dto.age ?? null,
    });
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    return this.issue(user);
  }

  /** Cuenta desechable para probar el juego sin registrarse. */
  async loginAsGuest() {
    const suffix = randomBytes(4).toString('hex');
    const name =
      GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
    const user = await this.usersService.create({
      name,
      email: `guest-${suffix}@absurd.local`,
      isGuest: true,
    });
    return this.issue(user);
  }

  async validateOAuthUser(
    provider: 'google' | 'apple',
    profile: { id: string; email: string; name?: string },
  ) {
    const linked =
      provider === 'google'
        ? await this.usersService.findByGoogleId(profile.id)
        : await this.usersService.findByAppleId(profile.id);
    if (linked) return linked;

    const existing = await this.usersService.findByEmail(profile.email);
    if (existing) {
      const id = existing._id.toString();
      if (provider === 'google') {
        await this.usersService.updateGoogleId(id, profile.id);
      } else {
        await this.usersService.updateAppleId(id, profile.id);
      }
      return this.usersService.findById(id);
    }

    return this.usersService.create({
      name: profile.name ?? profile.email.split('@')[0],
      email: profile.email,
      ...(provider === 'google'
        ? { googleId: profile.id }
        : { appleId: profile.id }),
    });
  }

  /**
   * Cambia la contraseña del usuario autenticado y levanta el aviso de cambio
   * obligatorio. Lo usa el panel tras el primer acceso del admin sembrado.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.getWithPassword(userId);
    if (!user?.password) {
      throw new BadRequestException('Esta cuenta no tiene contraseña');
    }
    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('La nueva contraseña debe ser distinta');
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.mustChangePassword = false;
    await user.save();

    return { message: 'Contraseña actualizada' };
  }

  async logout() {
    return { message: 'Sesión cerrada' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.getOrThrow(userId);
    return this.usersService.toResponse(user);
  }

  async issueTokenAndUser(
    _payload: { sub: string; email: string },
    user: UserDocument,
  ) {
    return this.issue(user);
  }
}
