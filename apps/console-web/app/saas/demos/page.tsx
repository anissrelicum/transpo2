import * as React from 'react';
import { redirect } from 'next/navigation';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { serverClient } from '../../../lib/server';
import { SaasDemosView } from '../../../components/SaasDemosView';

export const dynamic = 'force-dynamic';

export default async function SaasDemosPage() {
  // Même garde que les autres onglets : la session plateforme est vérifiée par l'API.
  try {
    await serverClient().getSaasPlans(false);
  } catch {
    redirect('/login?realm=saas');
  }
  // Les vidéos ne sont pas versionnées : la page dit lesquelles sont publiées sur ce serveur.
  const dossier = process.env.DEMOS_DIR || path.join(process.cwd(), 'demos');
  const disponibles = await fs.readdir(dossier).catch(() => [] as string[]);
  return <SaasDemosView disponibles={disponibles} />;
}
