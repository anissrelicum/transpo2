'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Flex, Box, Text, Heading, Button, IconButton, TextField, Avatar, Tooltip,
  Separator, DropdownMenu, Kbd,
} from '@radix-ui/themes';
import {
  DashboardIcon, ArchiveIcon, BarChartIcon, LockClosedIcon, SewingPinFilledIcon,
  TargetIcon, StackIcon, GlobeIcon, LayersIcon, ResetIcon, CubeIcon, IdCardIcon,
  TokensIcon, FileTextIcon, CardStackIcon, ArrowRightIcon, PersonIcon, BellIcon,
  PaperPlaneIcon, GearIcon, StarIcon, RocketIcon, MagnifyingGlassIcon, SunIcon,
  MoonIcon, ChevronDownIcon, ExitIcon, Cross2Icon,
} from '@radix-ui/react-icons';
import { useAppTheme } from './theme-provider';

type Item = { id: string; label: string; icon: React.ComponentType<any>; href?: string };
type Group = { group: string; items: Item[] };

// IA de navigation reprise de la maquette (lib.jsx NAV). Toutes les entrées sont
// branchées à un écran réel ; l'`id` correspond au 1er segment de la route.
const NAV: Group[] = [
  { group: 'Opérations', items: [
    { id: 'dashboard', label: 'Tableau de bord', icon: DashboardIcon, href: '/dashboard' },
    { id: 'orders', label: 'Commandes', icon: ArchiveIcon, href: '/orders' },
    { id: 'analytics', label: 'Analytics & SLA', icon: BarChartIcon, href: '/analytics' },
    { id: 'fraud', label: 'Fraude COD', icon: LockClosedIcon, href: '/fraud' },
    { id: 'tournees', label: 'Tournées', icon: StackIcon, href: '/tournees' },
    { id: 'dispatch', label: 'Dispatch', icon: SewingPinFilledIcon, href: '/dispatch' },
    { id: 'fleet', label: 'PC flotte', icon: TargetIcon, href: '/fleet' },
    { id: 'zones', label: 'Zones', icon: GlobeIcon, href: '/zones' },
    { id: 'hub', label: 'Tri en hub', icon: LayersIcon, href: '/hub' },
    { id: 'returns', label: 'Retours', icon: ResetIcon, href: '/returns' },
  ]},
  { group: 'Flotte', items: [
    { id: 'vehicles', label: 'Véhicules', icon: CubeIcon, href: '/vehicles' },
    { id: 'drivers', label: 'Chauffeurs', icon: IdCardIcon, href: '/drivers' },
  ]},
  { group: 'Facturation', items: [
    { id: 'pricing', label: 'Tarification', icon: TokensIcon, href: '/pricing' },
    { id: 'invoices', label: 'Factures', icon: FileTextIcon, href: '/invoices' },
    { id: 'cash', label: 'Caisse', icon: CardStackIcon, href: '/cash' },
    { id: 'payout', label: 'Reversement COD', icon: ArrowRightIcon, href: '/payout' },
  ]},
  { group: 'Administration', items: [
    { id: 'users', label: 'Utilisateurs', icon: PersonIcon, href: '/users' },
    { id: 'notifications', label: 'Notifications', icon: BellIcon, href: '/notifications' },
    { id: 'reviews', label: 'Avis clients', icon: StarIcon, href: '/reviews' },
    { id: 'templates', label: 'Modèles de notif.', icon: PaperPlaneIcon, href: '/templates' },
    { id: 'settings', label: 'Paramètres', icon: GearIcon, href: '/settings' },
  ]},
];

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const enabled = !!item.href;
  const Icon = item.icon;
  const btn = (
    <Button
      variant={active ? 'soft' : 'ghost'}
      color={active ? 'indigo' : 'gray'}
      size="2"
      disabled={!enabled}
      style={{ width: '100%', justifyContent: 'flex-start', gap: 'var(--space-2)' }}
    >
      <Icon width={16} height={16} />
      <Text size="2">{item.label}</Text>
    </Button>
  );
  if (!enabled) {
    return (
      <Tooltip content="Écran à venir">
        <span style={{ display: 'block', width: '100%' }}>{btn}</span>
      </Tooltip>
    );
  }
  return <Link href={item.href!} style={{ display: 'block', width: '100%' }}>{btn}</Link>;
}

function Sidebar({ active }: { active: string }) {
  return (
    <Box
      p="3"
      style={{
        width: 244, flex: '0 0 244px', borderInlineEnd: '1px solid var(--gray-a4)',
        background: 'var(--color-panel-solid)', position: 'sticky', top: 0,
        alignSelf: 'flex-start', height: '100vh', overflowY: 'auto',
      }}
    >
      <Flex align="center" gap="2" px="2" py="2" mb="3">
        <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: 'var(--radius-3)', background: 'var(--indigo-9)', color: 'white' }}>
          <RocketIcon width={17} height={17} />
        </Flex>
        <Box>
          <Text as="div" weight="bold" size="3">Transpo</Text>
          <Text as="div" size="1" color="gray">Console transport</Text>
        </Box>
      </Flex>
      {NAV.map((grp) => (
        <Box key={grp.group} mb="4">
          <Text as="div" size="1" color="gray" weight="medium" ml="2" mb="1"
            style={{ textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 11 }}>
            {grp.group}
          </Text>
          <Flex direction="column" gap="1">
            {grp.items.map((it) => (
              <NavItem key={it.id} item={it} active={active === it.id} />
            ))}
          </Flex>
        </Box>
      ))}
    </Box>
  );
}

function Topbar({ name, role }: { name: string; role: string }) {
  const { appearance, toggle } = useAppTheme();
  const router = useRouter();
  const [q, setQ] = React.useState('');

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.assign('/login'); // navigation dure (cookies purgés côté serveur)
  }
  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(q.trim() ? `/orders?q=${encodeURIComponent(q.trim())}` : '/orders');
  }
  const initials = name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Flex align="center" justify="between" gap="3" px="4" py="2"
      style={{ borderBottom: '1px solid var(--gray-a4)', position: 'sticky', top: 0, background: 'var(--color-panel-solid)', zIndex: 5, minHeight: 56 }}>
      <Box style={{ flex: 1, minWidth: 180, maxWidth: 380 }}>
        <form onSubmit={search}>
          <TextField.Root size="2" radius="large" placeholder="Rechercher une commande, un marchand, un code…"
            value={q} onChange={(e) => setQ(e.target.value)}>
            <TextField.Slot><MagnifyingGlassIcon height={16} width={16} /></TextField.Slot>
            {q
              ? <TextField.Slot side="right"><IconButton size="1" variant="ghost" color="gray" type="button" onClick={() => setQ('')}><Cross2Icon /></IconButton></TextField.Slot>
              : <TextField.Slot side="right"><Kbd>⏎</Kbd></TextField.Slot>}
          </TextField.Root>
        </form>
      </Box>
      <Flex align="center" gap="3">
        <Tooltip content={appearance === 'dark' ? 'Passer en clair' : 'Passer en sombre'}>
          <IconButton size="2" variant="ghost" color="gray" onClick={toggle}>
            {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </Tooltip>
        <Tooltip content="Notifications">
          <IconButton size="2" variant="ghost" color="gray"><BellIcon /></IconButton>
        </Tooltip>
        <Separator orientation="vertical" size="1" />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <Flex align="center" gap="2" style={{ cursor: 'pointer' }}>
              <Avatar size="2" radius="full" fallback={initials} color="indigo" />
              <Box style={{ lineHeight: 1.2 }}>
                <Text as="div" size="2" weight="medium">{name}</Text>
                <Text as="div" size="1" color="gray">{role}</Text>
              </Box>
              <ChevronDownIcon color="var(--gray-9)" />
            </Flex>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item color="red" onSelect={logout}>
              <ExitIcon /> Se déconnecter
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>
    </Flex>
  );
}

/** Coquille applicative : sidebar + topbar autour du contenu de page. */
export function AppShell({ name, role, children }: { name: string; role: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // id de nav actif dérivé du 1er segment de l'URL (/orders → orders, etc.)
  const active = (pathname || '/').split('/')[1] || 'dashboard';
  return (
    <Flex align="stretch" style={{ minHeight: '100vh' }}>
      <Sidebar active={active} />
      <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
        <Topbar name={name} role={role} />
        <Box p={{ initial: '4', md: '5' }} style={{ flex: 1 }}>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
