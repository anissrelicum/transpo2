import { Injectable } from '@nestjs/common';
import { withTenantDb, companySettings } from '@transpo/db';
import { eq } from 'drizzle-orm';

const CURRENCIES = ['MAD'];
const TIMEZONES = ['Africa/Casablanca'];
const LANGS = ['fr', 'ar'];

@Injectable()
export class SettingsService {
  get(schema: string) {
    return withTenantDb(schema, async (db) => {
      const [row] = await db.select().from(companySettings).where(eq(companySettings.id, 'default'));
      return {
        legalName: row?.legalName ?? null,
        ice: row?.ice ?? null,
        rc: row?.rc ?? null,
        address: row?.address ?? null,
        currency: row?.currency ?? 'MAD',
        timezone: row?.timezone ?? 'Africa/Casablanca',
        defaultLang: row?.defaultLang ?? 'fr',
      };
    });
  }

  save(schema: string, input: { legalName?: string; ice?: string; rc?: string; address?: string; currency?: string; timezone?: string; defaultLang?: string }) {
    const currency = input.currency && CURRENCIES.includes(input.currency) ? input.currency : 'MAD';
    const timezone = input.timezone && TIMEZONES.includes(input.timezone) ? input.timezone : 'Africa/Casablanca';
    const defaultLang = input.defaultLang && LANGS.includes(input.defaultLang) ? input.defaultLang : 'fr';
    const values = {
      legalName: input.legalName?.trim() || null,
      ice: input.ice?.trim() || null,
      rc: input.rc?.trim() || null,
      address: input.address?.trim() || null,
      currency, timezone, defaultLang,
      updatedAt: new Date(),
    };
    return withTenantDb(schema, async (db) => {
      await db.insert(companySettings).values({ id: 'default', ...values })
        .onConflictDoUpdate({ target: companySettings.id, set: values });
      return { ok: true, ...values };
    });
  }
}
