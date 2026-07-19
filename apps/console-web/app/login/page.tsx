'use client';
import * as React from 'react';
import { Flex, Box, Card, Heading, Text, TextField, Button, Callout } from '@radix-ui/themes';

export default function LoginPage() {
  const [email, setEmail] = React.useState('admin@casaexpress.ma');
  const [password, setPassword] = React.useState('transpo');
  const [tenant, setTenant] = React.useState('casaexpress');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, tenant }),
    });
    if (res.ok) {
      // Navigation dure : requête complète avec les cookies → rend le shell serveur
      // proprement (évite la course push+refresh de Next 14).
      window.location.assign('/dashboard');
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
          <Text size="2" color="gray">Console transport</Text>
        </Flex>
        <Card size="4">
          <form onSubmit={submit}>
            <Flex direction="column" gap="3">
              <Heading size="4">Connexion</Heading>
              {error && (
                <Callout.Root color="red" role="alert" size="1"><Callout.Text>{error}</Callout.Text></Callout.Root>
              )}
              <Box>
                <Text as="label" size="2" weight="medium">Organisation</Text>
                <TextField.Root name="tenant" value={tenant} onChange={(e) => setTenant(e.target.value)} mt="1" />
              </Box>
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
            </Flex>
          </form>
        </Card>
      </Box>
    </Flex>
  );
}
