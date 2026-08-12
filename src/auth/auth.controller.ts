import { Controller, Post, Body, Get, UseGuards, Req, NotImplementedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from '../admin/dto/moderation.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { GoogleEnabledGuard } from './guards/google-enabled.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup')
  signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }

  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** Cuenta de invitado para probar el juego sin registrarse. */
  @Public()
  @Post('guest')
  guest() {
    return this.authService.loginAsGuest();
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout() {
    return this.authService.logout();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /** Cambio de contraseña del propio usuario. */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Public()
  @Get('google')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  googleAuth() {
    // Redirects to Google OAuth
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleEnabledGuard, AuthGuard('google'))
  async googleAuthCallback(@Req() req: { user: { id: string; email: string; name?: string } }) {
    const user = await this.authService.validateOAuthUser('google', req.user);
    const payload = { sub: user!._id.toString(), email: user!.email };
    return this.authService.issueTokenAndUser(payload, user!);
  }

  @Public()
  @Get('apple')
  appleAuth() {
    throw new NotImplementedException('Apple Sign In not configured. Set APPLE_* env vars and add strategy.');
  }

  @Public()
  @Get('apple/callback')
  appleAuthCallback() {
    throw new NotImplementedException('Apple Sign In not configured.');
  }
}
