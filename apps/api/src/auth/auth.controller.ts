import { Controller, Post, Body, Req, Inject, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  // Login utilisateur de tenant. Tenant via header x-tenant-slug (dev) ou sous-domaine.
  @Post('login')
  @HttpCode(200)
  login(@Req() req: any, @Body() body: { email?: string; password?: string }) {
    const slug = (req.headers['x-tenant-slug'] as string | undefined)?.trim();
    return this.auth.loginTenant(slug, body?.email ?? '', body?.password ?? '');
  }

  // Login super-admin plateforme (realm séparé).
  @Post('super/login')
  @HttpCode(200)
  superLogin(@Body() body: { email?: string; password?: string }) {
    return this.auth.loginSuperAdmin(body?.email ?? '', body?.password ?? '');
  }
}
