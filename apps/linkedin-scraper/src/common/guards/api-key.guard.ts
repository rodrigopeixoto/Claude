import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.config.get<string>('SCRAPER_API_KEY');
    if (!expectedKey) {
      throw new UnauthorizedException('SCRAPER_API_KEY is not configured on the server');
    }

    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-api-key'];

    if (providedKey !== expectedKey) {
      throw new UnauthorizedException('Invalid or missing x-api-key header');
    }

    return true;
  }
}
