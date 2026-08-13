import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppleEnabledGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID');
    if (!clientId?.trim()) {
      throw new NotImplementedException(
        'Apple Sign In no está configurado. Pon APPLE_CLIENT_ID (el bundle id de iOS) en .env.',
      );
    }
    return true;
  }
}
