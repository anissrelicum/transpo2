'use client';
import * as React from 'react';
import { Flex, Box, Card, Heading, Text, TextField, Button, Callout, Badge } from '@radix-ui/themes';

// Miroir client de tenantFromHost (lib/server) — pour l'affichage seulement.
function orgFromHost(host: string): string | null {
  const name = host.split(':')[0];
  if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return null;
  const labels = name.split('.');
  if (labels.length < 2) return null;
  const first = labels[0].toLowerCase();
  if (['www', 'localhost', 'app'].includes(first)) return null;
  return first;
}

export default function LoginPage() {
  const [email, setEmail] = React.useState('admin@casaexpress.ma');
  const [password, setPassword] = React.useState('transpo');
  const [org, setOrg] = React.useState<string | null>(null);   // override ?org= (dev/test)
  const [detected, setDetected] = React.useState<string>('');  // org affichée
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [superAdmin, setSuperAdmin] = React.useState(false);   // realm plateforme (console SaaS)

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qOrg = params.get('org');
    const host = orgFromHost(window.location.host);
    setOrg(qOrg);
    setDetected(qOrg || host || 'par défaut');
    if (params.get('realm') === 'saas') setSuperAdmin(true);
  }, []);

  function switchRealm(toSuper: boolean) {
    setSuperAdmin(toSuper);
    setError(null);
    setEmail(toSuper ? 'ops@transpo.ma' : 'admin@casaexpress.ma');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Le tenant est résolu par le serveur depuis le host ; on ne transmet que
      // l'override éventuel (?org=) pour le dev/test.
      body: JSON.stringify({ email, password, tenant: org || undefined, superAdmin: superAdmin || undefined }),
    });
    if (res.ok) {
      window.location.assign(superAdmin ? '/saas' : '/dashboard'); // navigation dure (cookies posés)
      return;
    }
    setLoading(false);
    const d = await res.json().catch(() => null);
    setError(d?.error ?? 'Échec de connexion');
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', background: 'var(--gray-2)' }}>
      <Box style={{ width: 380 }}>
        <Flex direction="column" align="center" gap="2" mb="4">
          <Heading size="6">Transpo</Heading>
          <Text size="2" color="gray">{superAdmin ? 'Console SaaS — plateforme' : 'Console transport'}</Text>
        </Flex>
        <Card size="4">
          <form onSubmit={submit}>
            <Flex direction="column" gap="3">
              <Heading size="4">Connexion</Heading>
              {error && (
                <Callout.Root color="red" role="alert" size="1"><Callout.Text>{error}</Callout.Text></Callout.Root>
              )}
              <Flex align="center" justify="between">
                <Text size="2" color="gray">{superAdmin ? 'Realm' : 'Organisation'}</Text>
                <Badge color={superAdmin ? 'amber' : 'indigo'} data-testid="detected-org">
                  {superAdmin ? 'plateforme' : detected}
                </Badge>
              </Flex>
              <Box>
                <Text as="label" size="2" weight="medium">E-mail</Text>
                <TextField.Root name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} mt="1" />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium">Mot de passe</Text>
                <TextField.Root name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} mt="1" />
              </Box>
              <Button type="submit" size="3" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? 'Connexion…' : 'Se connecter'}
              </Button>
              <Text size="1" color="gray" align="center">
                {superAdmin
                  ? 'Compte plateforme, hors organisation.'
                  : 'L’organisation est déterminée par l’adresse (sous-domaine).'}
              </Text>
              <Text
                size="1" align="center" color="indigo" role="button" tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => switchRealm(!superAdmin)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchRealm(!superAdmin); }}
              >
                {superAdmin ? '← Connexion à une organisation' : 'Connexion console SaaS (plateforme) →'}
              </Text>
            </Flex>
          </form>
        </Card>
      </Box>
    </Flex>
  );
}
