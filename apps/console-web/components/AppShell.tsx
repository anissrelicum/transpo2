'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Flex, Box, Text, Heading, Button, IconButton, TextField, Avatar, Tooltip,
  Separator, DropdownMenu, Kbd, Popover, Badge,
} from '@radix-ui/themes';
import {
  DashboardIcon, ArchiveIcon, BarChartIcon, LockClosedIcon, SewingPinFilledIcon,
  TargetIcon, StackIcon, GlobeIcon, LayersIcon, ResetIcon, CubeIcon, IdCardIcon,
  TokensIcon, FileTextIcon, CardStackIcon, ArrowRightIcon, PersonIcon, BellIcon,
  PaperPlaneIcon, GearIcon, StarIcon, BackpackIcon, MagnifyingGlassIcon, SunIcon, ReaderIcon,
  MoonIcon, ChevronDownIcon, ExitIcon, Cross2Icon,
} from '@radix-ui/react-icons';
import { useAppTheme } from './theme-provider';
import { LangSwitch } from './LangSwitch';
import { t, type Lang, type Key, type Translate } from '@transpo/i18n';
import { Marque } from './Marque';
import type { DispatchExceptionRow } from '@transpo/api-client';
import { dispatchT, exceptionLabel, EXCEPTION_COLOR } from '../lib/dispatch-i18n';

/**
 * Exceptions de l'affectation automatique, relues toutes les 30 s et à chaque navigation.
 * Réservé aux rôles qui les traitent (ADMIN/DISPATCHER) : l'API refuserait les autres.
 */
function useDispatchAlerts(enabled: boolean, pathname: string | null): DispatchExceptionRow[] {
  const [rows, setRows] = React.useState<DispatchExceptionRow[]>([]);
  const load = React.useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch('/api/proxy/v1/dispatch/exceptions', { cache: 'no-store' });
      if (res.ok) setRows(await res.json());
    } catch { /* réseau : on garde le dernier état connu */ }
  }, [enabled]);
  React.useEffect(() => { void load(); }, [load, pathname]);
  React.useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => { void load(); }, 30000);
    return () => clearInterval(id);
  }, [enabled, load]);
  return rows;
}

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
    { id: 'merchants', key: 'nav.merchants', icon: BackpackIcon, href: '/merchants' },
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
    { id: 'docs', key: 'nav.docs', icon: ReaderIcon, href: '/docs' },
  ]},
];

function NavItem({ item, active, tr, count }: { item: Item; active: boolean; tr: Translate; count?: number }) {
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
      {count ? <Badge color="red" radius="full" size="1" style={{ marginInlineStart: 'auto' }}>{count}</Badge> : null}
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

function Sidebar({ active, tr, exceptions }: { active: string; tr: Translate; exceptions: number }) {
  return (
    <Box
      p="3"
      style={{
        width: 244, flex: '0 0 244px', borderInlineEnd: '1px solid var(--gray-a4)',
        background: 'var(--color-panel-solid)', position: 'sticky', top: 0,
        alignSelf: 'flex-start', height: '100vh', overflowY: 'auto',
      }}
    >
      <Box px="2" py="2" mb="3">
        <Marque taille={32} sousTitre={tr('login.subtitle')} />
      </Box>
      {NAV.map((grp) => (
        <Box key={grp.key} mb="4">
          <Text as="div" size="1" color="gray" weight="medium" ml="2" mb="1"
            style={{ textTransform: 'uppercase', letterSpacing: '.04em', fontSize: 11 }}>
            {tr(grp.key)}
          </Text>
          <Flex direction="column" gap="1">
            {grp.items.map((it) => (
              <NavItem key={it.id} item={it} active={active === it.id} tr={tr}
                count={it.id === 'dispatch' ? exceptions : undefined} />
            ))}
          </Flex>
        </Box>
      ))}
    </Box>
  );
}

function Topbar({ name, role, lang, tr, alerts }: { name: string; role: string; lang: Lang; tr: Translate; alerts: DispatchExceptionRow[] }) {
  const dt = dispatchT(lang);
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
        {/* Le libellé d'une infobulle n'est PAS le nom accessible d'un bouton (Radix pose
            un `aria-describedby`, pas un `aria-label`) : ces deux boutons n'étaient donc
            annoncés que par leur icône, c'est-à-dire par rien. */}
        <Tooltip content={appearance === 'dark' ? 'Passer en clair' : 'Passer en sombre'}>
          <IconButton
            size="2" variant="ghost" color="gray" onClick={toggle}
            aria-label={appearance === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
          >
            {appearance === 'dark' ? <SunIcon /> : <MoonIcon />}
          </IconButton>
        </Tooltip>
        {/* La cloche était un bouton sans effet : elle ouvre désormais les alertes de
            l'exploitation (exceptions de l'affectation automatique) et mène au centre de
            notifications. */}
        <Popover.Root>
          <Popover.Trigger>
            <IconButton size="2" variant="ghost" color="gray" aria-label={tr('nav.notifications')} style={{ position: 'relative' }}>
              <BellIcon />
              {alerts.length > 0 && (
                <Box style={{
                  position: 'absolute', top: 2, insetInlineEnd: 2, minWidth: 16, height: 16, borderRadius: 8,
                  background: 'var(--red-9)', color: 'white', fontSize: 10, fontWeight: 700, lineHeight: '16px',
                  textAlign: 'center', paddingInline: 3,
                }} data-testid="bell-count">{alerts.length > 9 ? '9+' : alerts.length}</Box>
              )}
            </IconButton>
          </Popover.Trigger>
          <Popover.Content width="340px" align="end">
            <Text as="div" size="2" weight="bold" mb="2">{dt('bellTitle')}</Text>
            {alerts.length === 0 ? (
              <Text as="div" size="2" color="gray" mb="2">{dt('bellNone')}</Text>
            ) : (
              <Box mb="2">
                <Text as="div" size="1" color="gray" mb="2">{dt('bellCount', { n: alerts.length })}</Text>
                <Flex direction="column" gap="1">
                  {alerts.slice(0, 5).map((a) => (
                    <Flex key={a.ref} align="center" justify="between" gap="2">
                      <Link href={`/orders/${encodeURIComponent(a.ref)}`}><Text size="2">{a.ref}</Text></Link>
                      <Badge size="1" variant="soft" color={EXCEPTION_COLOR[a.reason]}>{exceptionLabel(a.reason, lang).label}</Badge>
                    </Flex>
                  ))}
                </Flex>
              </Box>
            )}
            <Flex gap="2" justify="end" wrap="wrap">
              <Popover.Close>
                <Button size="1" variant="soft" color="gray" onClick={() => router.push('/notifications')}>{dt('bellSeeAll')}</Button>
              </Popover.Close>
              {alerts.length > 0 && (
                <Popover.Close>
                  <Button size="1" onClick={() => router.push('/dispatch?vue=exceptions')}>{dt('bellSeeExceptions')}</Button>
                </Popover.Close>
              )}
            </Flex>
          </Popover.Content>
        </Popover.Root>
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
export function AppShell({ name, role, lang, canDispatch = false, children }: {
  name: string; role: string; lang: Lang; canDispatch?: boolean; children: React.ReactNode;
}) {
  const pathname = usePathname();
  const alerts = useDispatchAlerts(canDispatch, pathname);
  // id de nav actif dérivé du 1er segment de l'URL (/orders → orders, etc.)
  const active = (pathname || '/').split('/')[1] || 'dashboard';
  const tr = t(lang);
  return (
    <Flex align="stretch" style={{ minHeight: '100vh' }}>
      <Sidebar active={active} tr={tr} exceptions={alerts.length} />
      <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
        <Topbar name={name} role={role} lang={lang} tr={tr} alerts={alerts} />
        <Box p={{ initial: '4', md: '5' }} style={{ flex: 1 }}>
          {children}
        </Box>
      </Flex>
    </Flex>
  );
}
