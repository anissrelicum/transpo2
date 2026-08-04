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
import { LangSwitch } from './LangSwitch';
import { t, type Lang, type Key, type Translate } from '@transpo/i18n';

type Item = { id: string; key: Key; icon: React.ComponentType<any>; href?: string };
type Group = { key: Key; items: Item[] };

// IA de navigation reprise de la maquette (lib.jsx NAV). Toutes les entrées sont
// branchées à un écran réel ; l'`id` correspond au 1er segment de la route.
const NAV: Group[] = [
  { key: 'nav.operations', items: [
    { id: 'dashboard', key: 'nav.dashboard', icon: DashboardIcon, href: '/dashboard' },
    { id: 'orders', key: 'nav.orders', icon: ArchiveIcon, href: '/orders' },
    { id: 'analytics', key: 'nav.analytics', icon: BarChartIcon, href: '/analytics' },
    { id: 'fraud', key: 'nav.fraud', icon: LockClosedIcon, href: '/fraud' },
    { id: 'tournees', key: 'nav.tournees', icon: StackIcon, href: '/tournees' },
    { id: 'dispatch', key: 'nav.dispatch', icon: SewingPinFilledIcon, href: '/dispatch' },
    { id: 'fleet', key: 'nav.fleetLive', icon: TargetIcon, href: '/fleet' },
    { id: 'zones', key: 'nav.zones', icon: GlobeIcon, href: '/zones' },
    { id: 'hub', key: 'nav.hub', icon: LayersIcon, href: '/hub' },
    { id: 'returns', key: 'nav.returns', icon: ResetIcon, href: '/returns' },
  ]},
  { key: 'nav.fleet', items: [
    { id: 'vehicles', key: 'nav.vehicles', icon: CubeIcon, href: '/vehicles' },
    { id: 'drivers', key: 'nav.drivers', icon: IdCardIcon, href: '/drivers' },
  ]},
  { key: 'nav.billing', items: [
    { id: 'pricing', key: 'nav.pricing', icon: TokensIcon, href: '/pricing' },
    { id: 'invoices', key: 'nav.invoices', icon: FileTextIcon, href: '/invoices' },
    { id: 'cash', key: 'nav.cash', icon: CardStackIcon, href: '/cash' },
    { id: 'payout', key: 'nav.payout', icon: ArrowRightIcon, href: '/payout' },
  ]},
  { key: 'nav.administration', items: [
    { id: 'users', key: 'nav.users', icon: PersonIcon, href: '/users' },
    { id: 'notifications', key: 'nav.notifications', icon: BellIcon, href: '/notifications' },
    { id: 'reviews', key: 'nav.reviews', icon: StarIcon, href: '/reviews' },
    { id: 'templates', key: 'nav.templates', icon: PaperPlaneIcon, href: '/templates' },
    { id: 'settings', key: 'nav.settings', icon: GearIcon, href: '/settings' },
  ]},
];

function NavItem({ item, active, tr }: { item: Item; active: boolean; tr: Translate }) {
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
      <Text size="2">{tr(item.key)}</Text>
    </Button>
  );
  if (!enabled) {
    return (
      <Tooltip content={tr('common.loading')}>
        <span style={{ display: 'block', width: '100%' }}>{btn}</span>
      </Tooltip>
    );
  }
  return <Link href={item.href!} style={{ display: 'block', width: '100%' }}>{btn}</Link>;
}

function Sidebar({ active, tr }: { active: string; tr: Translate }) {
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
          <Text as="div" size="1" color="gray">{tr('login.subtitle')}</Text>
        </Box>
      </Flex>
      {NAV.map((grp) => (
        <Box key={grp.key} mb="4">
          <Text as="div" size="1" color="gray" weight="medium" ml="2" mb="1"
            style={{ textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 11 }}>
            {tr(grp.key)}
          </Text>
          <Flex direction="column" gap="1">
            {grp.items.map((it) => (
              <NavItem key={it.id} item={it} active={active === it.id} tr={tr} />
            ))}
          </Flex>
        </Box>
      ))}
    </Box>
  );
}

function Topbar({ name, role, lang, tr }: { name: string; role: string; lang: Lang; tr: Translate }) {
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
          <TextField.Root size="2" radius="large" placeholder={tr('nav.searchPlaceholder')}
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
        <Tooltip content={tr('nav.notifications')}>
          <IconButton size="2" variant="ghost" color="gray"><BellIcon /></IconButton>
        </Tooltip>
        <LangSwitch lang={lang} label={tr('common.language')} />
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
              <ExitIcon /> {tr('common.logout')}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>
    </Flex>
  );
}

/** Coquille applicative : sidebar + topbar autour du contenu de page. */
export function AppShell({ name, role, lang, children }: {
  name: string; role: string; lang: Lang; children: React.ReactNode;
}) {
  const pathname = usePathname();
  // id de nav actif dérivé du 1er segment de l'URL (/orders → orders, etc.)
  const active = (pathname || '/').split('/')[1] || 'dashboard';
  const tr = t(lang);
  return (
    <Flex align="stretch" style={{ minHeight: '100vh' }}>
      <Sidebar active={active} tr={tr} />
      <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
        <Topbar name={name} role={role} lang={lang} tr={tr} />
        <Box p={{ initial: '4', md: '5' }} style={{ flex: 1 }}>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
