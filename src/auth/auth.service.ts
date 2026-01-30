import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserDocument } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signUp(signUpDto: SignUpDto) {
    const existing = await this.usersService.findByEmail(signUpDto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const hashedPassword = await bcrypt.hash(signUpDto.password, 10);
    const user = await this.usersService.create({
      name: signUpDto.name,
      email: signUpDto.email,
      password: hashedPassword,
    });
    const payload = { sub: user._id.toString(), email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: this.usersService.toResponse(user),
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const isMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const payload = { sub: user._id.toString(), email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: this.usersService.toResponse(user),
    };
  }

  async validateOAuthUser(
    provider: 'google' | 'apple',
    profile: { id: string; email: string; name?: string },
  ) {
    const user =
      provider === 'google'
        ? await this.usersService.findByGoogleId(profile.id)
        : await this.usersService.findByAppleId(profile.id);

    if (user) {
      return user;
    }

    let existing = await this.usersService.findByEmail(profile.email);
    if (existing) {
      if (provider === 'google') {
        await this.usersService.updateGoogleId(existing._id.toString(), profile.id);
      } else {
        await this.usersService.updateAppleId(existing._id.toString(), profile.id);
      }
      return this.usersService.findById(existing._id.toString());
    }

    return this.usersService.create({
      name: profile.name ?? profile.email.split('@')[0],
      email: profile.email,
      ...(provider === 'google'
        ? { googleId: profile.id }
        : { appleId: profile.id }),
    });
  }

  async logout() {
    return { message: 'Logged out successfully' };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.getOrThrow(userId);
    return this.usersService.toResponse(user);
  }

  issueTokenAndUser(payload: { sub: string; email: string }, user: UserDocument) {
    return {
      access_token: this.jwtService.sign(payload),
      user: this.usersService.toResponse(user),
    };
  }
}
