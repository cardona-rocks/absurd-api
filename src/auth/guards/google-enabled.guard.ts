import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleEnabledGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(_context: ExecutionContext): boolean {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId?.trim()) {
      throw new NotImplementedException(
        'Google Sign In not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.',
      );
    }
    return true;
  }
}
