import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Les preuves de livraison transitent en data URI (photo + signature) : la limite
  // Express par défaut (100 Ko) les rejetterait avant la validation métier, avec un
  // « request entity too large » incompréhensible pour le livreur. La borne réelle
  // reste appliquée par artefact dans DriverService.
  app.useBodyParser('json', { limit: '2mb' });
  const port = Number(process.env.API_PORT) || 3000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Transpo API — écoute sur http://localhost:${port}`);
}

bootstrap();
