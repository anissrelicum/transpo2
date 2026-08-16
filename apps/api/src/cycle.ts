// Avance le cycle d'abonnement (spec §7). Appelé quotidiennement par le cron Dokku :
//   dokku run transpo-api sh -c 'cd /repo/apps/api && pnpm cycle'
//
// Passe par le contexte Nest plutôt que par un accès SQL direct : la logique de transition
// ne doit exister qu'à un seul endroit (SubscriptionsService), sans quoi le cron et
// l'endpoint /v1/saas/cycle/run finiraient par diverger.
//
// Idempotent : rejouable autant de fois que voulu le même jour.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SubscriptionsService } from './saas/subscriptions.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const r = await app.get(SubscriptionsService).runCycle(null);
    // eslint-disable-next-line no-console
    console.log(
      `Cycle ${r.day} — ${r.trialsExpired} essai(s) expiré(s), ${r.suspended} suspension(s), ` +
        `${r.renewed} reconduction(s), ${r.projected} statut(s) tenant réaligné(s).`,
    );
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
