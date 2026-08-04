'use client';
import * as React from 'react';
import { Flex, Box, Card, Heading, Text, TextField, Button, Callout, Badge } from '@radix-ui/themes';
import { t, type Lang } from '@transpo/i18n';

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

export function LoginForm({ lang }: { lang: Lang }) {
  const tr = t(lang);
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
      const { role } = await res.json().catch(() => ({ role: undefined }));
      // Chaque realm a sa racine : plateforme, espace marchand, console transport.
      const home = superAdmin ? '/saas' : role === 'MERCHANT' ? '/portail' : '/dashboard';
      window.location.assign(home); // navigation dure (cookies posés)
      return;
    }
    setLoading(false);
    const d = await res.json().catch(() => null);
    setError(d?.error ?? tr('login.failed'));
  }

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', background: 'var(--gray-2)' }}>
      <Box style={{ width: 380 }}>
        <Flex direction="column" align="center" gap="2" mb="4">
          <Heading size="6">Transpo</Heading>
          <Text size="2" color="gray">{tr(superAdmin ? 'login.saasSubtitle' : 'login.subtitle')}</Text>
        </Flex>
        <Card size="4">
          <form onSubmit={submit}>
            <Flex direction="column" gap="3">
              <Heading size="4">{tr('common.login')}</Heading>
              {error && (
                <Callout.Root color="red" role="alert" size="1"><Callout.Text>{error}</Callout.Text></Callout.Root>
              )}
              <Flex align="center" justify="between">
                <Text size="2" color="gray">{tr(superAdmin ? 'login.realm' : 'login.organisation')}</Text>
                <Badge color={superAdmin ? 'amber' : 'indigo'} data-testid="detected-org">
                  {superAdmin ? tr('login.platform') : detected}
                </Badge>
              </Flex>
              <Box>
                <Text as="label" size="2" weight="medium">{tr('common.email')}</Text>
                <TextField.Root name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} mt="1" />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium">{tr('common.password')}</Text>
                <TextField.Root name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} mt="1" />
              </Box>
              <Button type="submit" size="3" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? tr('login.signingIn') : tr('common.login')}
              </Button>
              <Text size="1" color="gray" align="center">
                {tr(superAdmin ? 'login.platformHint' : 'login.hostHint')}
              </Text>
              <Text
                size="1" align="center" color="indigo" role="button" tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => switchRealm(!superAdmin)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchRealm(!superAdmin); }}
              >
                {tr(superAdmin ? 'login.toTenant' : 'login.toSaas')}
              </Text>
            </Flex>
          </form>
        </Card>
      </Box>
    </Flex>
  );
}
