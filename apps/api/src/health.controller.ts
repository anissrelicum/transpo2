import { Controller, Get } from '@nestjs/common';
import { pool } from './db/pool.js';

@Controller('health')
export class HealthController {
  @Get()
  async check() {
    await pool.query('SELECT 1');
    return { status: 'ok', service: 'transpo-api' };
  }
}
