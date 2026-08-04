// Transpo — Lot 3 : App mobile livreur (maquettes React + Radix, cadre 390×844)
import React from 'https://esm.sh/react@18.3.1';
import { createRoot } from 'https://esm.sh/react-dom@18.3.1/client';

const T = window.Transpo;
const { RT, RI, StatusBadge, money, LeafletMap, THEME, toast, ToastHost } = T;
const GOALS = T.GOALS;
const {
  Theme, Flex, Box, Grid, Card, Inset, Separator, ScrollArea, Text, Heading, Badge, Button,
  IconButton, TextField, TextArea, Select, Avatar, Tooltip, Callout, Skeleton, SegmentedControl,
  Progress, Dialog, AlertDialog, Switch, Checkbox, RadioGroup, Code, Link, Spinner, Slider,
} = RT;
const {
  RocketIcon, SunIcon, MoonIcon, CheckIcon, CheckCircledIcon, CrossCircledIcon, Cross2Icon,
  ChevronRightIcon, ChevronLeftIcon, ArrowRightIcon, ArrowLeftIcon, MobileIcon, CameraIcon,
  BellIcon, SewingPinFilledIcon, TargetIcon, HomeIcon, CubeIcon, PersonIcon, ChatBubbleIcon,
  ImageIcon, Pencil2Icon, ReloadIcon, ExclamationTriangleIcon, InfoCircledIcon, ClockIcon,
  LapTimerIcon, BackpackIcon, ArchiveIcon, ExitIcon, EnvelopeClosedIcon, LockClosedIcon,
  PlusIcon, MinusIcon, DotFilledIcon, UpdateIcon, PauseIcon, PaperPlaneIcon, GlobeIcon,
  ArrowUpIcon, ArrowDownIcon, LightningBoltIcon, StackIcon, GearIcon, QuestionMarkCircledIcon, ChevronDownIcon,
} = RI;
const { useState } = React;

const PHONE_W = 390, PHONE_H = 844;

/* ---------- Éléments système du téléphone ---------- */
function StatusBar({ dark }) {
  const c = 'var(--gray-12)';
  return (
    <Flex align="center" justify="between" px="4" style={{ height: 44, flex: '0 0 44px', color: c }}>
      <Text size="2" weight="bold">9:41</Text>
      <Flex align="center" gap="1">
        <Box style={{ width: 17, height: 11, border: `1.5px solid ${c}`, borderRadius: 3, position: 'relative', opacity: 0.9 }}>
          <Box style={{ position: 'absolute', inset: 1.5, right: 5, background: c, borderRadius: 1 }} />
        </Box>
        <Text size="1" weight="medium">4G</Text>
      </Flex>
    </Flex>
  );
}

function PhoneShell({ children, tab, setTab, showTabs = true, dark, lang }) {
  const ar = lang === 'ar';
  const TABS = [
    { id: 'missions', label: ar ? 'المهام' : 'Missions', icon: ArchiveIcon },
    { id: 'route', label: ar ? 'الجولة' : 'Tournée', icon: StackIcon },
    { id: 'scan', label: ar ? 'مسح' : 'Scanner', icon: CameraIcon },
    { id: 'shift', label: ar ? 'الوردية' : 'Shift', icon: LapTimerIcon },
    { id: 'profil', label: ar ? 'الملف' : 'Profil', icon: PersonIcon },
  ];
  return (
    <Flex direction="column" style={{ width: '100%', height: '100%', background: 'var(--color-background)' }}>
      <StatusBar dark={dark} />
      <Box style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</Box>
      {showTabs && (
        <Flex align="stretch" style={{ flex: '0 0 64px', borderTop: '1px solid var(--gray-a4)', background: 'var(--color-panel-solid)' }}>
          {TABS.map((tb) => {
            const on = tab === tb.id;
            return (
              <Flex key={tb.id} direction="column" align="center" justify="center" gap="1" onClick={() => setTab && setTab(tb.id)}
                style={{ flex: 1, cursor: 'pointer', color: on ? 'var(--indigo-11)' : 'var(--gray-9)', paddingBottom: 6 }}>
                <tb.icon width="20" height="20" />
                <Text size="1" weight={on ? 'medium' : 'regular'}>{tb.label}</Text>
              </Flex>
            );
          })}
        </Flex>
      )}
    </Flex>
  );
}

// Barre d'action principale collée en bas
function BottomAction({ children }) {
  return (
    <Box style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 'var(--space-3)', background: 'linear-gradient(to top, var(--color-background) 72%, transparent)' }}>
      {children}
    </Box>
  );
}
function PrimaryBtn(props) {
  return <Button size="4" style={{ width: '100%', height: 52 }} {...props} />;
}

function ScreenHead({ title, sub, onBack, right }) {
  return (
    <Flex align="center" gap="2" px="4" py="3" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
      {onBack && <IconButton variant="ghost" color="gray" size="3" onClick={onBack} style={{ minWidth: 44, minHeight: 44 }}><ArrowLeftIcon width="20" height="20" /></IconButton>}
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Heading size="4">{title}</Heading>
        {sub && <Text as="div" size="1" color="gray">{sub}</Text>}
      </Box>
      {right}
    </Flex>
  );
}

/* =========================================================================
   8 — Connexion + onboarding permissions
   ========================================================================= */
function Login({ go }) {
  const [step, setStep] = useState('login');
  const PERMS = [
    { id: 'gps', icon: TargetIcon, title: 'Localisation', desc: 'Suivi en temps réel pendant vos courses, même en arrière-plan.', color: 'indigo' },
    { id: 'cam', icon: CameraIcon, title: 'Caméra', desc: 'Photographier la preuve de livraison des colis.', color: 'cyan' },
    { id: 'notif', icon: BellIcon, title: 'Notifications', desc: 'Recevoir vos nouvelles missions et alertes de dispatch.', color: 'amber' },
  ];
  const [granted, setGranted] = useState({});

  if (step === 'login') {
    return (
      <Flex direction="column" style={{ height: '100%' }} px="5">
        <Flex direction="column" align="center" gap="3" style={{ flex: 1, justifyContent: 'center' }}>
          <Flex align="center" justify="center" style={{ width: 64, height: 64, borderRadius: 'var(--radius-5)', background: 'var(--indigo-9)', color: 'white' }}><RocketIcon width="32" height="32" /></Flex>
          <Heading size="7">Transpo Livreur</Heading>
          <Text size="2" color="gray" align="center">Connectez-vous pour démarrer votre journée.</Text>
          <Box style={{ width: '100%', marginTop: 'var(--space-4)' }}>
            <Flex direction="column" gap="3">
              <TextField.Root size="3" placeholder="Téléphone ou identifiant" defaultValue="+212 6 12 34 56 78" style={{ height: 50 }}>
                <TextField.Slot><PersonIcon /></TextField.Slot>
              </TextField.Root>
              <TextField.Root size="3" placeholder="Mot de passe" type="password" defaultValue="000000" style={{ height: 50 }}>
                <TextField.Slot><LockClosedIcon /></TextField.Slot>
              </TextField.Root>
            </Flex>
          </Box>
        </Flex>
        <Box pb="5">
          <PrimaryBtn onClick={() => setStep('perms')}>Se connecter</PrimaryBtn>
          <Flex justify="center" gap="4" mt="3"><Link size="2" color="gray">Mot de passe oublié ?</Link><Link size="2" onClick={() => go('onboarding')} style={{ cursor: 'pointer' }}>Devenir livreur</Link></Flex>
        </Box>
      </Flex>
    );
  }

  const allGranted = PERMS.every((p) => granted[p.id]);
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <Box px="5" pt="5" pb="2">
        <Heading size="6">Autorisations</Heading>
        <Text size="2" color="gray">Trois accès sont nécessaires pour livrer.</Text>
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" px="5" py="3">
          {PERMS.map((p) => (
            <Card key={p.id} size="2">
              <Flex align="center" gap="3">
                <Flex align="center" justify="center" style={{ width: 44, height: 44, borderRadius: 'var(--radius-3)', background: `var(--${p.color}-a3)`, color: `var(--${p.color}-11)`, flex: '0 0 44px' }}><p.icon width="22" height="22" /></Flex>
                <Box style={{ flex: 1 }}>
                  <Text as="div" size="3" weight="medium">{p.title}</Text>
                  <Text as="div" size="1" color="gray">{p.desc}</Text>
                </Box>
                {granted[p.id]
                  ? <Badge color="green" variant="soft" size="2"><CheckIcon /> Accordé</Badge>
                  : <Button size="2" variant="soft" onClick={() => setGranted((g) => ({ ...g, [p.id]: true }))} style={{ minHeight: 44 }}>Autoriser</Button>}
              </Flex>
            </Card>
          ))}
          <Callout.Root color="gray" variant="surface" size="1">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>Vous pourrez ajuster ces accès à tout moment dans les réglages du téléphone.</Callout.Text>
          </Callout.Root>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <PrimaryBtn disabled={!allGranted} onClick={() => go('missions')}>
          {allGranted ? 'Commencer ma journée' : `${PERMS.filter((p) => granted[p.id]).length}/3 autorisations`}
        </PrimaryBtn>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   9 — Missions du jour
   ========================================================================= */
const MISSIONS = [
  { id: 'M1', ref: 'CMD-20260712-014', status: 'LIVRAISON', pickup: 'Boutique Zellige · Maârif', drop: 'Av. Hassan II, Agdal', dist: '3,2 km', cod: 1250, size: 'Moyen' },
  { id: 'M2', ref: 'CMD-20260712-009', status: 'ASSIGNEE', pickup: 'Souss Électro · Aïn Sebaâ', drop: 'Rue de Fès, Belvédère', dist: '6,8 km', cod: 3200, size: 'Très grand' },
  { id: 'M3', ref: 'CMD-20260712-005', status: 'ASSIGNEE', pickup: 'Medina Books · Habous', drop: 'Bd Zerktouni, Gauthier', dist: '4,1 km', cod: 0, size: 'Petit' },
  { id: 'M4', ref: 'CMD-20260712-021', status: 'ASSIGNEE', pickup: 'Atlas Cosmetics · CIL', drop: 'Rue d’Alger, centre', dist: '2,5 km', cod: 680, size: 'Petit' },
];

/* =========================================================================
   Centre de notifications / alertes push
   ========================================================================= */
const NOTIFS = [
  { id: 'n1', type: 'mission', title: 'Nouvelle mission assignée', body: 'CMD-…018 — retrait Boutique Zellige, Maârif', time: 'il y a 2 min', unread: true },
  { id: 'n2', type: 'address', title: 'Changement d’adresse', body: 'CMD-…014 — nouvelle adresse : 8 av. Hassan II, Agdal', time: 'il y a 8 min', unread: true },
  { id: 'n3', type: 'cancel', title: 'Mission annulée', body: 'CMD-…012 a été annulée par le marchand', time: 'il y a 21 min', unread: true },
  { id: 'n4', type: 'cod', title: 'Rappel COD', body: 'CMD-…009 — encaisser 3 200 DH à la livraison', time: 'il y a 40 min', unread: false },
  { id: 'n5', type: 'shift', title: 'Pause obligatoire bientôt', body: 'EU 561 — 45 min de pause requises dans 30 min', time: 'il y a 1 h', unread: false },
];
const NTYPE = {
  mission: { icon: <ArchiveIcon />, color: 'indigo' },
  address: { icon: <SewingPinFilledIcon />, color: 'amber' },
  cancel: { icon: <Cross2Icon />, color: 'red' },
  cod: { icon: <CubeIcon />, color: 'green' },
  shift: { icon: <LapTimerIcon />, color: 'cyan' },
};
function Notifications({ go }) {
  const [items, setItems] = useState(NOTIFS);
  const unread = items.filter((n) => n.unread).length;
  const read = (id) => setItems((a) => a.map((n) => n.id === id ? { ...n, unread: false } : n));
  const allRead = () => setItems((a) => a.map((n) => ({ ...n, unread: false })));
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Notifications" sub={unread + ' non lue(s)'} onBack={() => go('missions')} right={<Button size="1" variant="ghost" disabled={!unread} onClick={allRead}>Tout lire</Button>} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="2" p="4" pb="8">
          {items.map((n) => {
            const t = NTYPE[n.type] || NTYPE.mission;
            return (
              <Card key={n.id} size="2" onClick={() => read(n.id)} style={{ cursor: 'pointer', background: n.unread ? `var(--${t.color}-a2)` : undefined, border: n.unread ? `1px solid var(--${t.color}-a5)` : '1px solid var(--gray-a3)' }}>
                <Flex gap="3" align="start">
                  <Flex align="center" justify="center" style={{ width: 36, height: 36, borderRadius: '50%', flex: '0 0 36px', background: `var(--${t.color}-a3)`, color: `var(--${t.color}-11)` }}>{t.icon}</Flex>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" justify="between" gap="2"><Text size="2" weight="medium">{n.title}</Text>{n.unread && <Box style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${t.color}-9)`, flex: '0 0 8px' }} />}</Flex>
                    <Text size="1" color="gray" as="div">{n.body}</Text>
                    <Text size="1" color="gray" as="div" mt="1">{n.time}</Text>
                  </Box>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/* =========================================================================
   Centre de notifications / alertes push
   =END= */
function PushBanner({ go }) {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <Card size="2" style={{ background: 'var(--indigo-a3)', border: '1px solid var(--indigo-a5)' }}>
      <Flex align="center" gap="3">
        <Flex align="center" justify="center" style={{ width: 34, height: 34, borderRadius: '50%', flex: '0 0 34px', background: 'var(--indigo-9)', color: 'white' }}><BellIcon /></Flex>
        <Box style={{ flex: 1, minWidth: 0 }} onClick={() => { setShow(false); go('notifs'); }}>
          <Text as="div" size="2" weight="medium">Nouvelle mission assignée</Text>
          <Text as="div" size="1" color="gray">CMD-…018 · Maârif — appuyez pour voir</Text>
        </Box>
        <IconButton size="1" variant="ghost" color="gray" onClick={() => setShow(false)}><Cross2Icon /></IconButton>
      </Flex>
    </Card>
  );
}
function Missions({ go, state, lang }) {
  const ar = lang === 'ar';
  const tr = {
    date: ar ? 'السبت 12 يوليوز' : 'Samedi 12 juillet',
    title: ar ? 'مهامي' : 'Mes missions',
    active: ar ? '4 نشطة' : '4 actives',
    toDeliver: ar ? 'للتسليم' : 'À livrer',
    delivered: ar ? 'مُسلّمة' : 'Livrées',
    prepaid: ar ? 'مدفوع مسبقاً' : 'Prépayé',
  };
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <Box px="4" pt="3" pb="2">
        <Flex justify="between" align="center">
          <Box>
            <Text size="1" color="gray">{tr.date}</Text>
            <Heading size="6">{tr.title}</Heading>
          </Box>
          <Flex align="center" gap="2">
            <Badge size="2" color="indigo" variant="soft" radius="full">{tr.active}</Badge>
            <Box style={{ position: 'relative' }} onClick={() => go('notifs')}>
              <IconButton size="2" variant="soft" color="gray"><BellIcon /></IconButton>
              <Box style={{ position: 'absolute', top: -3, insetInlineEnd: -3, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--red-9)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>3</Box>
            </Box>
          </Flex>
        </Flex>
        <Flex gap="2" mt="3">
          <Card size="1" style={{ flex: 1 }}><Text as="div" size="1" color="gray">{tr.toDeliver}</Text><Text size="4" weight="bold">4</Text></Card>
          <Card size="1" style={{ flex: 1 }}><Text as="div" size="1" color="gray">{tr.delivered}</Text><Text size="4" weight="bold" style={{ color: 'var(--green-11)' }}>7</Text></Card>
          <Card size="1" style={{ flex: 1 }}><Text as="div" size="1" color="gray">COD</Text><Text size="4" weight="bold" style={{ color: 'var(--amber-11)' }}>5,1k</Text></Card>
        </Flex>
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" px="4" py="3" pb="6">
          <PushBanner go={go} />
          {state === 'loading'
            ? [1, 2, 3].map((i) => <Skeleton key={i} height="128px" style={{ borderRadius: 'var(--radius-4)' }} />)
            : MISSIONS.map((m, i) => (
              <Card key={m.id} size="2" onClick={() => go('detail')} style={{ cursor: 'pointer' }}>
                <Flex direction="column" gap="3">
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="2">
                      <Flex align="center" justify="center" style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--indigo-9)', color: 'white' }}><Text size="1" weight="bold">{i + 1}</Text></Flex>
                      <Text size="2" weight="bold">{m.ref}</Text>
                    </Flex>
                    <StatusBadge status={m.status} lang={lang} />
                  </Flex>
                  <Flex direction="column" gap="2">
                    <Flex gap="2" align="start"><Box style={{ color: 'var(--gray-9)', marginTop: 2 }}><HomeIcon width="15" /></Box><Text size="2" color="gray">{m.pickup}</Text></Flex>
                    <Flex gap="2" align="start"><Box style={{ color: 'var(--indigo-9)', marginTop: 2 }}><SewingPinFilledIcon width="15" /></Box><Text size="2">{m.drop}</Text></Flex>
                  </Flex>
                  <Separator size="4" />
                  <Flex justify="between" align="center">
                    <Flex align="center" gap="3">
                      <Flex align="center" gap="1"><TargetIcon width="13" color="var(--gray-9)" /><Text size="1" color="gray">{m.dist}</Text></Flex>
                      <Flex align="center" gap="1"><CubeIcon width="13" color="var(--gray-9)" /><Text size="1" color="gray">{m.size}</Text></Flex>
                    </Flex>
                    {m.cod ? <Badge color="amber" variant="soft" radius="full">{(ar ? 'للتحصيل: ' : 'COD · ') + money(m.cod)}</Badge> : <Badge color="gray" variant="soft" radius="full">{tr.prepaid}</Badge>}
                  </Flex>
                </Flex>
              </Card>
            ))}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/* =========================================================================
   10 — Détail de mission
   ========================================================================= */
function MissionDetail({ go, appearance }) {
  const m = MISSIONS[0];
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title={m.ref} sub="Étape : livraison" onBack={() => go('missions')} right={<StatusBadge status={m.status} />} />
      <Box style={{ height: 160, position: 'relative', flex: '0 0 160px' }}>
        <LeafletMap appearance={appearance} center={[33.585, -7.618]} zoom={13} interactive={false}
          markers={[
            { id: 'd', kind: 'driver', ini: 'YB', latlng: [33.589, -7.633], color: 'amber' },
            { id: 't', kind: 'order', latlng: [33.578, -7.605], color: 'green' },
          ]} />
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          <StepCard icon={<HomeIcon />} tone="gray" title="Retrait" name="Boutique Zellige" addr="14, rue Ibn Batouta, Maârif · Casablanca" phone="+212 522 47 18 03" done />
          <StepCard icon={<SewingPinFilledIcon />} tone="indigo" title="Livraison" name="Salma Idrissi" addr="8, avenue Hassan II, Agdal · Casablanca" phone="+212 6 61 22 84 90" />
          <Card size="2">
            <Flex direction="column" gap="2">
              <Flex align="center" gap="2"><CubeIcon color="var(--gray-9)" /><Text size="2" weight="medium">Colis</Text></Flex>
              <Text size="2" color="gray">Coffret céramique · Moyen · Fragile</Text>
              <Flex gap="2" mt="1" wrap="wrap"><Badge color="amber" variant="soft" radius="full">COD à encaisser · {money(1250)}</Badge><Badge color="gray" variant="soft" radius="full">Preuve : photo + signature</Badge></Flex>
            </Flex>
          </Card>
          <Callout.Root color="gray" variant="surface" size="1">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>Note : appeler avant d’arriver, 3e étage sans ascenseur.</Callout.Text>
          </Callout.Root>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <Flex gap="2" style={{ width: '100%' }}>
          <ContactSheet name="Salma Idrissi" phone="+212 6 61 22 84 90" role="Destinataire" trigger={<IconButton size="4" variant="soft" color="gray" style={{ flex: '0 0 52px', height: 52 }}><ChatBubbleIcon width="20" /></IconButton>} />
          <ContactSheet name="Salma Idrissi" phone="+212 6 61 22 84 90" role="Destinataire" trigger={<IconButton size="4" variant="soft" color="gray" style={{ flex: '0 0 52px', height: 52 }}><MobileIcon width="20" /></IconButton>} />
          <Button size="4" onClick={() => go('status')} style={{ flex: 1, minWidth: 0, height: 52 }}><SewingPinFilledIcon /> Naviguer</Button>
        </Flex>
      </BottomAction>
    </Flex>
  );
}

/* ---------- Contact client en un geste (bottom sheet) ---------- */
function ContactSheet({ name, phone, role, trigger }) {
  const masked = phone ? phone.replace(/(\d{2})\s?\d{2}\s?\d{2}$/, '$1 •• ••') : '';
  const quick = ['J’arrive dans 5 minutes.', 'Je suis en bas de l’immeuble.', 'Pouvez-vous descendre récupérer le colis ?', 'Livraison Transpo — préparez l’appoint SVP.'];
  const [msg, setMsg] = useState(quick[0]);
  return (
    <Dialog.Root>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="360px">
        <Flex align="center" gap="3" mb="1">
          <Avatar size="3" radius="full" fallback={(name || '?').split(' ').map((x) => x[0]).join('').slice(0, 2)} color="indigo" />
          <Box><Dialog.Title mb="0">{name}</Dialog.Title><Text size="1" color="gray">{role || 'Destinataire'} · {masked}</Text></Box>
        </Flex>
        <Flex align="center" gap="1" mb="3"><LockClosedIcon width="12" color="var(--gray-9)" /><Text size="1" color="gray">Numéro masqué — appel relayé par Transpo</Text></Flex>
        <Grid columns="3" gap="2" mb="3">
          <ContactBtn icon={<MobileIcon width="20" />} label="Appeler" color="indigo" />
          <ContactBtn icon={<ChatBubbleIcon width="20" />} label="WhatsApp" color="green" />
          <ContactBtn icon={<EnvelopeClosedIcon width="18" />} label="SMS" color="gray" />
        </Grid>
        <Text size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Message rapide</Text>
        <Flex direction="column" gap="2">
          {quick.map((q) => (
            <Card key={q} size="1" onClick={() => setMsg(q)} style={{ cursor: 'pointer', border: msg === q ? '1px solid var(--indigo-8)' : '1px solid var(--gray-a3)', background: msg === q ? 'var(--indigo-a2)' : undefined }}>
              <Flex align="center" gap="2"><Box style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid ' + (msg === q ? 'var(--indigo-9)' : 'var(--gray-7)'), background: msg === q ? 'var(--indigo-9)' : 'transparent', flex: '0 0 14px' }} /><Text size="2">{q}</Text></Flex>
            </Card>
          ))}
        </Flex>
        <Flex gap="2" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Fermer</Button></Dialog.Close>
          <Dialog.Close><Button color="green"><PaperPlaneIcon /> Envoyer via WhatsApp</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
function ContactBtn({ icon, label, color }) {
  const msg = label === 'Appeler' ? 'Appel relayé en cours…' : label === 'WhatsApp' ? 'WhatsApp ouvert' : 'SMS ouvert';
  return (
    <Flex direction="column" align="center" gap="1" onClick={() => toast(msg, { icon: 'info', color })} style={{ cursor: 'pointer', padding: '10px 4px', borderRadius: 'var(--radius-3)', background: `var(--${color}-a3)`, color: `var(--${color}-11)` }}>
      {icon}<Text size="1" weight="medium">{label}</Text>
    </Flex>
  );
}

function StepCard({ icon, tone, title, name, addr, phone, done }) {
  return (
    <Card size="2">
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between">
          <Flex align="center" gap="2">
            <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: 'var(--radius-3)', background: `var(--${tone}-a3)`, color: `var(--${tone}-11)` }}>{icon}</Flex>
            <Text size="2" weight="bold">{title}</Text>
          </Flex>
          {done && <Badge color="green" variant="soft"><CheckIcon /> Fait</Badge>}
        </Flex>
        <Box>
          <Text as="div" size="3" weight="medium">{name}</Text>
          <Text as="div" size="2" color="gray">{addr}</Text>
        </Box>
        <Flex gap="2">
          <ContactSheet name={name} phone={phone} role={title === 'Retrait' ? 'Expéditeur' : 'Destinataire'} trigger={<Button size="2" variant="soft" style={{ flex: 1, minWidth: 0, minHeight: 44 }}><MobileIcon /> Appeler</Button>} />
          <ContactSheet name={name} phone={phone} role={title === 'Retrait' ? 'Expéditeur' : 'Destinataire'} trigger={<Button size="2" variant="soft" color="green" style={{ flex: 1, minWidth: 0, minHeight: 44 }}><ChatBubbleIcon /> WhatsApp</Button>} />
        </Flex>
      </Flex>
    </Card>
  );
}

/* =========================================================================
   11 — Mise à jour de statut (séquentiel)
   ========================================================================= */
const FLOW = [
  { s: 'ASSIGNEE', action: 'Démarrer vers le retrait', next: 'RETRAIT' },
  { s: 'RETRAIT', action: 'Colis récupéré', next: 'RECUPEREE' },
  { s: 'RECUPEREE', action: 'Démarrer la livraison', next: 'LIVRAISON' },
  { s: 'LIVRAISON', action: 'Marquer comme livrée', next: 'LIVREE' },
];

function StatusUpdate({ go }) {
  const [idx, setIdx] = useState(3); // arrivé à l'étape livraison
  const cur = FLOW[idx];
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Progression" sub="CMD-20260712-014" onBack={() => go('detail')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" px="4" py="4" pb="8">
          {FLOW.map((f, i) => {
            const done = i < idx, active = i === idx;
            return (
              <Flex key={f.s} gap="3">
                <Flex direction="column" align="center">
                  <Flex align="center" justify="center" style={{ width: 32, height: 32, borderRadius: '50%', background: done ? 'var(--green-9)' : active ? 'var(--indigo-9)' : 'var(--gray-a4)', color: done || active ? 'white' : 'var(--gray-9)', flex: '0 0 32px' }}>
                    {done ? <CheckIcon width="17" /> : active ? <DotFilledIcon /> : <Text size="2">{i + 1}</Text>}
                  </Flex>
                  {i < FLOW.length - 1 && <Box style={{ width: 2, flex: 1, minHeight: 44, background: done ? 'var(--green-9)' : 'var(--gray-a4)' }} />}
                </Flex>
                <Box pb="4" style={{ flex: 1 }}>
                  <Text as="div" size="3" weight={active ? 'bold' : 'medium'} color={done || active ? undefined : 'gray'}>{T.STATUS[f.next].label}</Text>
                  <Text as="div" size="1" color="gray">{done ? 'Terminé · ' + ['09:31', '10:02', '12:20', '13:05'][i] : active ? 'Étape en cours' : 'À venir'}</Text>
                  {active && (
                    <Flex gap="2" mt="3">
                      <FailButton go={go} />
                    </Flex>
                  )}
                </Box>
              </Flex>
            );
          })}
        </Flex>
      </ScrollArea>
      <BottomAction>
        {idx < FLOW.length - 1 ? (
          <AlertDialog.Root>
            <AlertDialog.Trigger><PrimaryBtn><ArrowRightIcon /> {cur.action}</PrimaryBtn></AlertDialog.Trigger>
            <ConfirmContent title={cur.action + ' ?'} desc={`Le statut passera à « ${T.STATUS[cur.next].label} » et le client sera notifié.`} onOk={() => setIdx(idx + 1)} okLabel="Confirmer" />
          </AlertDialog.Root>
        ) : (
          <PrimaryBtn color="green" onClick={() => go('proof')}><CheckIcon /> Confirmer la livraison</PrimaryBtn>
        )}
      </BottomAction>
    </Flex>
  );
}

function FailButton({ go }) {
  return <Button size="2" variant="soft" color="red" onClick={() => go('fail')} style={{ minHeight: 44 }}><ExclamationTriangleIcon /> Signaler un échec</Button>;
}

function ConfirmContent({ title, desc, onOk, okLabel, okColor }) {
  return (
    <AlertDialog.Content maxWidth="330px">
      <AlertDialog.Title>{title}</AlertDialog.Title>
      <AlertDialog.Description size="2">{desc}</AlertDialog.Description>
      <Flex gap="3" mt="4" justify="end">
        <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
        <AlertDialog.Action><Button color={okColor || 'indigo'} onClick={onOk}>{okLabel}</Button></AlertDialog.Action>
      </Flex>
    </AlertDialog.Content>
  );
}

/* =========================================================================
   12 — Preuve de livraison (2 variantes de niveau)
   ========================================================================= */
function Proof({ go, proofLevel, setProofLevel }) {
  const needPhoto = proofLevel === 'photo' || proofLevel === 'photo_signature';
  const needSig = proofLevel === 'signature' || proofLevel === 'photo_signature';
  const [photos, setPhotos] = useState(needPhoto ? 2 : 0);
  const [signed, setSigned] = useState(false);
  const complete = (!needPhoto || photos > 0) && (!needSig || signed);

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Preuve de livraison" sub="CMD-20260712-014" onBack={() => go('status')} />
      <Box px="4" pt="3">
        <Text as="div" size="1" color="gray" mb="1">Niveau de preuve exigé (démo)</Text>
        <SegmentedControl.Root size="1" value={proofLevel} onValueChange={(v) => { setProofLevel(v); setPhotos(v.includes('photo') ? 2 : 0); setSigned(false); }}>
          <SegmentedControl.Item value="aucune">Aucune</SegmentedControl.Item>
          <SegmentedControl.Item value="photo">Photo</SegmentedControl.Item>
          <SegmentedControl.Item value="signature">Signat.</SegmentedControl.Item>
          <SegmentedControl.Item value="photo_signature">Photo+sig</SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4" pb="8">
          {proofLevel === 'aucune' && (
            <Callout.Root color="green" variant="surface">
              <Callout.Icon><CheckCircledIcon /></Callout.Icon>
              <Callout.Text>Aucune preuve n’est requise pour cette commande. Confirmez simplement la remise.</Callout.Text>
            </Callout.Root>
          )}

          {needPhoto && (
            <Box>
              <Flex justify="between" align="center" mb="2">
                <Text size="2" weight="medium">Photos <Text color="red">*</Text> <Text size="1" color="gray">({photos}/5)</Text></Text>
              </Flex>
              <Grid columns="3" gap="2">
                {Array.from({ length: photos }).map((_, i) => (
                  <Box key={i} style={{ aspectRatio: '1', borderRadius: 'var(--radius-3)', background: 'var(--indigo-a3)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--indigo-10)' }}>
                    <ImageIcon width="22" />
                    <IconButton size="1" color="red" variant="solid" radius="full" onClick={() => setPhotos(photos - 1)} style={{ position: 'absolute', top: 4, right: 4, minWidth: 22, minHeight: 22 }}><Cross2Icon width="11" /></IconButton>
                  </Box>
                ))}
                {photos < 5 && (
                  <Flex direction="column" align="center" justify="center" gap="1" onClick={() => setPhotos(photos + 1)}
                    style={{ aspectRatio: '1', borderRadius: 'var(--radius-3)', border: '1.5px dashed var(--gray-a6)', cursor: 'pointer', color: 'var(--gray-10)', minHeight: 48 }}>
                    <CameraIcon width="22" /><Text size="1">Ajouter</Text>
                  </Flex>
                )}
              </Grid>
            </Box>
          )}

          {needSig && (
            <Box>
              <Text size="2" weight="medium" mb="2" as="div">Signature <Text color="red">*</Text></Text>
              <Card size="1" style={{ position: 'relative' }}>
                <Box style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {signed ? (
                    <svg width="220" height="80" viewBox="0 0 220 80" style={{ color: 'var(--gray-12)' }}>
                      <path d="M10 55 C 30 20, 45 20, 55 45 S 80 70, 95 40 C 105 25, 120 30, 125 50 C 140 35, 165 15, 185 50 C 195 65, 205 45, 212 38" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <Flex direction="column" align="center" gap="2" style={{ color: 'var(--gray-9)' }}><Pencil2Icon width="24" /><Text size="1">Faire signer le destinataire</Text></Flex>
                  )}
                </Box>
                {signed && <IconButton size="1" variant="soft" color="gray" onClick={() => setSigned(false)} style={{ position: 'absolute', top: 8, right: 8 }}><ReloadIcon /></IconButton>}
              </Card>
              {!signed && <Button size="2" variant="soft" mt="2" style={{ width: '100%', minHeight: 44 }} onClick={() => setSigned(true)}><Pencil2Icon /> Capturer la signature</Button>}
            </Box>
          )}

          <Box>
            <Text size="2" weight="medium" mb="2" as="div">Nom du destinataire {needSig && <Text color="red">*</Text>}</Text>
            <TextField.Root size="3" placeholder="Nom de la personne qui réceptionne" defaultValue="Salma Idrissi" style={{ height: 48 }} />
          </Box>

          <Flex align="center" gap="2" p="2" style={{ background: 'var(--green-a2)', borderRadius: 'var(--radius-3)' }}>
            <TargetIcon color="var(--green-11)" /><Text size="1" color="green">Position GPS capturée · 33.5781, -7.6052 · ±8 m</Text>
          </Flex>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <PrimaryBtn color="green" disabled={!complete} onClick={() => go('cod')}>
          {complete ? 'Valider la preuve' : (needPhoto && photos === 0 ? 'Photo requise' : 'Signature requise')}
        </PrimaryBtn>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   13 — Encaissement COD
   ========================================================================= */
function Cod({ go }) {
  const amount = 1250;
  const [received, setReceived] = useState('1250');
  const change = Math.max(0, (Number(received) || 0) - amount);
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Encaissement" sub="Paiement à la livraison" onBack={() => go('proof')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4" pb="8">
          <Card size="3" style={{ background: 'var(--amber-a3)' }}>
            <Flex direction="column" align="center" gap="1" py="2">
              <Text size="2" style={{ color: 'var(--amber-11)' }}>Montant à encaisser</Text>
              <Heading size="9" style={{ color: 'var(--amber-11)' }}>{money(amount)}</Heading>
              <Badge color="amber" variant="surface">Espèces</Badge>
            </Flex>
          </Card>
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">Montant reçu</Text>
            <TextField.Root size="3" value={received} onChange={(e) => setReceived(e.target.value.replace(/[^0-9]/g, ''))} style={{ height: 54, fontSize: 22 }}>
              <TextField.Slot side="right"><Text size="4" color="gray">DH</Text></TextField.Slot>
            </TextField.Root>
            <Flex gap="2" mt="2">
              {[1250, 1300, 1500, 2000].map((v) => <Button key={v} size="2" variant="soft" color="gray" onClick={() => setReceived(String(v))} style={{ flex: 1, minHeight: 44 }}>{v}</Button>)}
            </Flex>
          </Box>
          {change > 0 && (
            <Flex justify="between" align="center" p="3" style={{ background: 'var(--gray-a3)', borderRadius: 'var(--radius-3)' }}>
              <Text size="2" color="gray">Monnaie à rendre</Text><Text size="4" weight="bold">{money(change)}</Text>
            </Flex>
          )}
          <Callout.Root color="gray" variant="surface" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Le montant sera reversé à Boutique Zellige, déduction faite de la commission.</Callout.Text></Callout.Root>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <AlertDialog.Root>
          <AlertDialog.Trigger><PrimaryBtn color="green" disabled={(Number(received) || 0) < amount}><CheckIcon /> Confirmer l’encaissement</PrimaryBtn></AlertDialog.Trigger>
          <ConfirmContent title="Encaissement confirmé ?" desc={`Vous confirmez avoir reçu ${money(amount)} en espèces. La livraison sera clôturée.`} onOk={() => go('done')} okLabel="Oui, encaissé" okColor="green" />
        </AlertDialog.Root>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   Historique des courses & gains (freelance)
   ========================================================================= */
const DRIVER_CONTRACT = 'FREELANCE';
const DRIVER_RATE = 18; // DH par course livrée
const HISTORY = [
  { ref: 'CMD-…014', date: '2026-07-16', city: 'Casablanca', cod: 1250 },
  { ref: 'CMD-…011', date: '2026-07-16', city: 'Casablanca', cod: 0 },
  { ref: 'CMD-…008', date: '2026-07-15', city: 'Mohammedia', cod: 750 },
  { ref: 'CMD-…006', date: '2026-07-15', city: 'Casablanca', cod: 430 },
  { ref: 'CMD-…004', date: '2026-07-14', city: 'Casablanca', cod: 0 },
  { ref: 'CMD-…002', date: '2026-07-12', city: 'Rabat', cod: 980 },
  { ref: 'CMD-…131', date: '2026-07-09', city: 'Casablanca', cod: 260 },
  { ref: 'CMD-…128', date: '2026-07-05', city: 'Casablanca', cod: 1500 },
  { ref: 'CMD-…120', date: '2026-06-28', city: 'Salé', cod: 640 },
  { ref: 'CMD-…118', date: '2026-06-24', city: 'Casablanca', cod: 0 },
];
function inPeriod(dateStr, period) {
  const d = new Date(dateStr); const now = new Date('2026-07-16');
  if (period === 'week') { const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0); return d >= monday; }
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function Earnings({ go }) {
  const [period, setPeriod] = useState('week');
  const rows = HISTORY.filter((h) => inPeriod(h.date, period));
  const count = rows.length;
  const gain = count * DRIVER_RATE;
  const freelance = DRIVER_CONTRACT === 'FREELANCE';
  const fmtDay = (s) => new Date(s).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' });
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Historique & gains" sub={freelance ? 'Freelance · ' + DRIVER_RATE + ' DH/course' : 'Salarié'} onBack={() => go('profil')} />
      <Box px="4" pt="3">
        <SegmentedControl.Root value={period} onValueChange={setPeriod} size="2" style={{ width: '100%' }}>
          <SegmentedControl.Item value="week" style={{ flex: 1 }}>Cette semaine</SegmentedControl.Item>
          <SegmentedControl.Item value="month" style={{ flex: 1 }}>Ce mois</SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>
      {freelance && (
        <Box px="4" pt="3">
          <Card size="3" style={{ background: 'var(--grass-a3)' }}>
            <Flex direction="column" align="center" gap="1" py="1">
              <Text size="2" style={{ color: 'var(--grass-11)' }}>Gains {period === 'week' ? 'de la semaine' : 'du mois'}</Text>
              <Heading size="8" style={{ color: 'var(--grass-11)', whiteSpace: 'nowrap' }}>{money(gain).replace(',00 DH', ' DH')}</Heading>
              <Text size="1" style={{ color: 'var(--grass-11)' }}>{count} courses × {DRIVER_RATE} DH</Text>
            </Flex>
          </Card>
        </Box>
      )}
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="2" p="4" pb="8">
          <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Courses livrées</Text>
          {count === 0 && <Callout.Root color="gray" variant="surface" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Aucune course livrée sur cette période.</Callout.Text></Callout.Root>}
          {rows.map((h) => (
            <Card key={h.ref} size="2">
              <Flex align="center" justify="between">
                <Flex align="center" gap="3">
                  <Flex align="center" justify="center" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--green-a3)', color: 'var(--green-11)' }}><CheckIcon /></Flex>
                  <Box><Text as="div" size="2" weight="medium">{h.ref}</Text><Text as="div" size="1" color="gray">{fmtDay(h.date)} · {h.city}</Text></Box>
                </Flex>
                {freelance
                  ? <Text size="3" weight="bold" style={{ color: 'var(--grass-11)' }}>+{DRIVER_RATE} DH</Text>
                  : (h.cod ? <Badge color="green" variant="soft" radius="full">COD {money(h.cod).replace(',00 DH', ' DH')}</Badge> : <Badge color="gray" variant="soft" radius="full">livrée</Badge>)}
              </Flex>
            </Card>
          ))}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/* =========================================================================
   Tournée multi-arrêts — optimisation interactive
   ========================================================================= */
const DEPOT = [33.573, -7.589]; // position livreur (Maârif)
const ROUTE_STOPS = [
  { id: 's1', ref: 'CMD-…014', name: 'Salma Idrissi', addr: 'Agdal', latlng: [33.556, -7.545], cod: 1250, done: false },
  { id: 's2', ref: 'CMD-…011', name: 'Riad Déco', addr: 'Gauthier', latlng: [33.591, -7.630], cod: 0, done: false },
  { id: 's3', ref: 'CMD-…009', name: 'Souss Électro', addr: 'Ain Diab', latlng: [33.595, -7.680], cod: 3200, done: false },
  { id: 's4', ref: 'CMD-…006', name: 'Karim Benjelloun', addr: 'Maârif', latlng: [33.578, -7.612], cod: 430, done: false },
  { id: 's5', ref: 'CMD-…003', name: 'Atlas Cosmetics', addr: 'Bourgogne', latlng: [33.601, -7.628], cod: 0, done: false },
  { id: 's6', ref: 'CMD-…001', name: 'Imane Ouazzani', addr: 'CIL', latlng: [33.567, -7.652], cod: 780, done: false },
];
function haversine(a, b) {
  const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
function routeDistance(stops) {
  let d = 0, prev = DEPOT;
  stops.forEach((s) => { d += haversine(prev, s.latlng); prev = s.latlng; });
  return d;
}
function nearestNeighbor(stops) {
  const rest = stops.slice(); const out = []; let cur = DEPOT;
  while (rest.length) {
    let bi = 0, bd = Infinity;
    rest.forEach((s, i) => { const dd = haversine(cur, s.latlng); if (dd < bd) { bd = dd; bi = i; } });
    cur = rest[bi].latlng; out.push(rest.splice(bi, 1)[0]);
  }
  return out;
}

function RouteScreen({ go, appearance }) {
  const [stops, setStops] = useState(ROUTE_STOPS);
  const [optimized, setOptimized] = useState(false);
  const done = stops.filter((s) => s.done);
  const pending = stops.filter((s) => !s.done);
  const current = pending[0];
  const rawDist = routeDistance(pending);
  const optDist = routeDistance(nearestNeighbor(pending));
  const gainKm = Math.max(0, rawDist - optDist);
  const totalDist = routeDistance(stops);
  const speed = 22; // km/h urbain
  const eta = (routeDistance(pending) / speed) * 60 + pending.length * 4; // + arrêt 4 min

  const optimize = () => { setStops([...done, ...nearestNeighbor(pending)]); setOptimized(true); };
  const move = (id, dir) => {
    setStops((arr) => {
      const i = arr.findIndex((s) => s.id === id); const j = i + dir;
      if (j < 0 || j >= arr.length || arr[j].done) return arr;
      const c = arr.slice(); [c[i], c[j]] = [c[j], c[i]]; return c;
    });
    setOptimized(false);
  };
  const deliver = (id) => setStops((arr) => arr.map((s) => s.id === id ? { ...s, done: true } : s));
  const reset = () => setStops(ROUTE_STOPS.map((s) => ({ ...s, done: false })));

  const orderedForMap = stops;
  const markers = [
    { id: 'depot', kind: 'driver', ini: 'YB', latlng: DEPOT, color: 'indigo' },
    ...pending.map((s, i) => ({ id: s.id, kind: 'stop', seq: i + 1, latlng: s.latlng, color: i === 0 ? 'amber' : 'gray' })),
  ];
  const polylines = [{ latlngs: [DEPOT, ...pending.map((s) => s.latlng)], color: 'var(--indigo-9)', weight: 3, dashArray: '1 6' }];

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Ma tournée" sub={done.length + '/' + stops.length + ' livrés · ' + totalDist.toFixed(1) + ' km'} onBack={() => go('missions')} right={<IconButton size="2" variant="ghost" color="gray" onClick={reset}><ReloadIcon /></IconButton>} />
      <Box style={{ height: 190, position: 'relative', flex: '0 0 190px' }}>
        <LeafletMap appearance={appearance} center={[33.582, -7.615]} zoom={12} interactive={false} markers={markers} polylines={polylines} />
      </Box>

      {/* Barre d'optimisation */}
      <Box px="4" pt="3">
        <Card size="2" style={{ background: optimized ? 'var(--grass-a3)' : undefined }}>
          <Flex align="center" justify="between" gap="3">
            <Box style={{ minWidth: 0 }}>
              <Flex align="center" gap="2"><LightningBoltIcon color={optimized ? 'var(--grass-11)' : 'var(--indigo-11)'} /><Text size="2" weight="bold">{optimized ? 'Tournée optimisée' : 'Optimiser la tournée'}</Text></Flex>
              <Text size="1" color="gray" as="div" mt="1">{optimized ? 'Ordre au plus court · ' + optDist.toFixed(1) + ' km' : (gainKm > 0.3 ? 'Économie estimée : ' + gainKm.toFixed(1) + ' km' : 'Ordre déjà efficace')}</Text>
            </Box>
            <Button size="2" color={optimized ? 'gray' : 'indigo'} variant={optimized ? 'soft' : 'solid'} disabled={pending.length < 2} onClick={optimize} style={{ flex: '0 0 auto' }}>{optimized ? 'Optimisé ✓' : 'Optimiser'}</Button>
          </Flex>
        </Card>
      </Box>

      {/* Résumé */}
      <Flex px="4" pt="3" gap="2">
        <SummaryCell label="Restants" value={String(pending.length)} />
        <SummaryCell label="Distance" value={routeDistance(pending).toFixed(1) + ' km'} />
        <SummaryCell label="Temps est." value={Math.round(eta) + ' min'} />
      </Flex>

      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="2" p="4" pb="8">
          {pending.length === 0 && <Callout.Root color="green" size="1"><Callout.Icon><CheckCircledIcon /></Callout.Icon><Callout.Text>Tournée terminée — tous les colis sont livrés.</Callout.Text></Callout.Root>}
          {stops.map((s) => {
            const idx = pending.findIndex((p) => p.id === s.id);
            const isCurrent = current && s.id === current.id;
            return (
              <Card key={s.id} size="2" style={{ opacity: s.done ? 0.55 : 1, border: isCurrent ? '1px solid var(--amber-8)' : '1px solid var(--gray-a3)', background: isCurrent ? 'var(--amber-a2)' : undefined }}>
                <Flex align="center" gap="3">
                  <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: '50%', flex: '0 0 30px', background: s.done ? 'var(--green-9)' : isCurrent ? 'var(--amber-9)' : 'var(--gray-a4)', color: s.done || isCurrent ? 'white' : 'var(--gray-11)' }}>
                    {s.done ? <CheckIcon width="15" /> : <Text size="2" weight="bold">{idx + 1}</Text>}
                  </Flex>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" gap="2"><Text size="2" weight="medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</Text>{isCurrent && <Badge color="amber" variant="soft" radius="full" size="1">suivant</Badge>}</Flex>
                    <Text size="1" color="gray" as="div">{s.ref} · {s.addr}{s.cod ? ' · COD ' + money(s.cod).replace(',00 DH', ' DH') : ''}</Text>
                  </Box>
                  {!s.done && (
                    <Flex direction="column" gap="1" style={{ flex: '0 0 auto' }}>
                      <IconButton size="1" variant="soft" color="gray" onClick={() => move(s.id, -1)}><ArrowUpIcon /></IconButton>
                      <IconButton size="1" variant="soft" color="gray" onClick={() => move(s.id, 1)}><ArrowDownIcon /></IconButton>
                    </Flex>
                  )}
                </Flex>
                {isCurrent && (
                  <Flex gap="2" mt="3">
                    <Button size="2" variant="soft" style={{ flex: '0 0 auto', minHeight: 44 }} onClick={() => go('detail')}><SewingPinFilledIcon /></Button>
                    <Button size="2" style={{ flex: 1, minWidth: 0, minHeight: 44 }} onClick={() => deliver(s.id)}><CheckIcon /> Marquer livré</Button>
                  </Flex>
                )}
              </Card>
            );
          })}
        </Flex>
      </ScrollArea>
    </Flex>
  );
}
function SummaryCell({ label, value }) {
  return (
    <Card size="1" style={{ flex: 1 }}>
      <Flex direction="column" align="center" gap="0" py="1">
        <Text size="3" weight="bold">{value}</Text>
        <Text size="1" color="gray">{label}</Text>
      </Flex>
    </Card>
  );
}

/* =========================================================================
   Scanner de colis — intégré, interactif
   ========================================================================= */
const SCAN_ITEMS = [
  { code: 'A7K2M9QX', ref: 'CMD-…014', name: 'Salma Idrissi' },
  { code: 'C9M4X2QK', ref: 'CMD-…011', name: 'Riad Déco' },
  { code: 'D2K7P5MX', ref: 'CMD-…009', name: 'Souss Électro' },
  { code: 'E5Q1M8KP', ref: 'CMD-…006', name: 'Karim Benjelloun' },
  { code: 'F8K3P2MQ', ref: 'CMD-…003', name: 'Atlas Cosmetics' },
];
function ScannerScreen({ go }) {
  const [phase, setPhase] = useState('retrait');
  const [scanned, setScanned] = useState([]); // codes
  const [flash, setFlash] = useState(null); // {kind, item, code}
  const [manual, setManual] = useState('');
  const total = SCAN_ITEMS.length;

  const handle = (code) => {
    const item = SCAN_ITEMS.find((i) => i.code === code);
    let kind;
    if (!item) kind = 'unknown';
    else if (scanned.includes(code)) kind = 'dup';
    else { kind = 'ok'; setScanned((s) => [code, ...s]); }
    setFlash({ kind, item, code });
    setTimeout(() => setFlash(null), 1600);
  };
  const scanNext = () => {
    const next = SCAN_ITEMS.find((i) => !scanned.includes(i.code));
    if (next) { handle(next.code); } else { setFlash({ kind: 'done' }); setTimeout(() => setFlash(null), 1600); }
  };
  const submitManual = () => { if (manual.length === 8) { handle(manual.toUpperCase()); setManual(''); } };

  const border = flash ? (flash.kind === 'ok' || flash.kind === 'done' ? 'var(--green-9)' : flash.kind === 'dup' ? 'var(--amber-9)' : 'var(--red-9)') : 'white';
  const allDone = scanned.length === total;

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Scanner" sub={scanned.length + '/' + total + ' colis scannés'} onBack={() => go('missions')} />
      <Box px="4" pt="3">
        <SegmentedControl.Root value={phase} onValueChange={setPhase} size="2" style={{ width: '100%' }}>
          <SegmentedControl.Item value="retrait" style={{ flex: 1 }}>Retrait</SegmentedControl.Item>
          <SegmentedControl.Item value="livraison" style={{ flex: 1 }}>Livraison</SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>

      {/* Viseur caméra */}
      <Box px="4" pt="3">
        <Box style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 'var(--radius-4)', overflow: 'hidden', background: 'var(--gray-12)' }}>
          <Flex align="center" justify="center" style={{ position: 'absolute', inset: 0, color: 'var(--gray-8)' }}><CameraIcon width="34" height="34" /></Flex>
          <Box style={{ position: 'absolute', inset: '16% 12%', border: '2px solid ' + border, borderRadius: 'var(--radius-3)', boxShadow: '0 0 0 100vmax rgba(0,0,0,.34)' }} />
          {!flash && <Box style={{ position: 'absolute', left: '12%', right: '12%', top: '50%', height: 2, background: 'var(--indigo-9)', boxShadow: '0 0 8px var(--indigo-9)' }} />}
          {flash && flash.kind !== 'done' && (
            <Flex direction="column" align="center" justify="center" gap="1" style={{ position: 'absolute', inset: 0 }}>
              <Flex align="center" justify="center" style={{ width: 54, height: 54, borderRadius: '50%', color: 'white', background: flash.kind === 'ok' ? 'var(--green-9)' : flash.kind === 'dup' ? 'var(--amber-9)' : 'var(--red-9)' }}>
                {flash.kind === 'ok' ? <CheckIcon width="30" height="30" /> : flash.kind === 'dup' ? <ExclamationTriangleIcon width="26" height="26" /> : <Cross2Icon width="30" height="30" />}
              </Flex>
              <Text size="2" weight="bold" style={{ color: 'white' }}>{flash.kind === 'ok' ? 'Colis reconnu' : flash.kind === 'dup' ? 'Déjà scanné' : 'Colis hors tournée'}</Text>
              {flash.item && <Text size="1" style={{ color: 'var(--gray-6)' }}>{flash.item.ref} · {flash.item.name}</Text>}
            </Flex>
          )}
          {flash && flash.kind === 'done' && (
            <Flex direction="column" align="center" justify="center" gap="1" style={{ position: 'absolute', inset: 0 }}>
              <Flex align="center" justify="center" style={{ width: 54, height: 54, borderRadius: '50%', background: 'var(--green-9)', color: 'white' }}><CheckIcon width="30" height="30" /></Flex>
              <Text size="2" weight="bold" style={{ color: 'white' }}>Tous les colis scannés</Text>
            </Flex>
          )}
        </Box>
      </Box>

      {/* Progression */}
      <Box px="4" pt="3">
        <Flex justify="between" mb="1"><Text size="1" color="gray">Progression du {phase}</Text><Text size="1" weight="medium">{scanned.length}/{total}</Text></Flex>
        <Progress value={(scanned.length / total) * 100} color={allDone ? 'green' : 'indigo'} size="2" />
      </Box>

      {/* Saisie manuelle */}
      <Box px="4" pt="3">
        <Flex gap="2">
          <TextField.Root size="2" placeholder="Saisie manuelle (8 car.)" value={manual} onChange={(e) => setManual(e.target.value.toUpperCase().slice(0, 8))} style={{ flex: 1 }}>
            <TextField.Slot><CubeIcon /></TextField.Slot>
          </TextField.Root>
          <Button size="2" variant="soft" disabled={manual.length !== 8} onClick={submitManual} style={{ minHeight: 40 }}>Valider</Button>
        </Flex>
      </Box>

      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="2" p="4" pb="8">
          <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Colis de la tournée</Text>
          {SCAN_ITEMS.map((it) => {
            const ok = scanned.includes(it.code);
            return (
              <Flex key={it.code} align="center" justify="between" p="2" style={{ borderRadius: 'var(--radius-3)', border: '1px solid var(--gray-a3)', background: ok ? 'var(--green-a2)' : undefined }}>
                <Flex align="center" gap="3" style={{ minWidth: 0 }}>
                  <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: '50%', flex: '0 0 30px', background: ok ? 'var(--green-9)' : 'var(--gray-a4)', color: ok ? 'white' : 'var(--gray-10)' }}>{ok ? <CheckIcon /> : <CubeIcon width="15" />}</Flex>
                  <Box style={{ minWidth: 0 }}><Text as="div" size="2" weight="medium">{it.name}</Text><Text as="div" size="1" color="gray">{it.ref} · <Code size="1" variant="ghost">{it.code}</Code></Text></Box>
                </Flex>
                {ok && <Badge color="green" variant="soft" radius="full">scanné</Badge>}
              </Flex>
            );
          })}
        </Flex>
      </ScrollArea>

      <BottomAction>
        <Flex gap="2" style={{ width: '100%' }}>
          <Tooltip content="Simuler un colis d’une autre tournée"><IconButton size="4" variant="soft" color="gray" style={{ flex: '0 0 52px', height: 52 }} onClick={() => handle('ZZ99ZZ99')}><ExclamationTriangleIcon width="20" /></IconButton></Tooltip>
          <Button size="4" style={{ flex: 1, minWidth: 0, height: 52 }} disabled={allDone} onClick={scanNext}><CameraIcon /> {allDone ? 'Terminé' : 'Scanner'}</Button>
        </Flex>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   Signalement d'incident
   ========================================================================= */
const INCIDENT_TYPES = [
  { id: 'vehicle', label: 'Accident / panne', icon: <ExclamationTriangleIcon width="20" />, sos: true },
  { id: 'damaged', label: 'Colis endommagé', icon: <CubeIcon width="20" /> },
  { id: 'aggressive', label: 'Client agressif', icon: <PersonIcon width="20" />, sos: true },
  { id: 'access', label: 'Zone inaccessible', icon: <SewingPinFilledIcon width="20" /> },
  { id: 'theft', label: 'Vol / perte', icon: <LockClosedIcon width="20" />, sos: true },
  { id: 'other', label: 'Autre', icon: <InfoCircledIcon width="20" /> },
];
const SEVERITY = [
  { id: 'low', label: 'Faible', color: 'gray' },
  { id: 'med', label: 'Moyen', color: 'amber' },
  { id: 'high', label: 'Urgent', color: 'red' },
];
function Incident({ go }) {
  const [type, setType] = useState(null);
  const [sev, setSev] = useState('med');
  const [desc, setDesc] = useState('');
  const [sent, setSent] = useState(false);
  const chosen = INCIDENT_TYPES.find((t) => t.id === type);
  const urgent = sev === 'high' || (chosen && chosen.sos && sev !== 'low');

  if (sent) return (
    <Flex direction="column" align="center" justify="center" gap="4" style={{ height: '100%' }} px="5">
      <Flex align="center" justify="center" style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--green-a3)', color: 'var(--green-11)' }}><CheckIcon width="36" height="36" /></Flex>
      <Box style={{ textAlign: 'center' }}>
        <Heading size="5" mb="1">Incident signalé</Heading>
        <Text size="2" color="gray">Le dispatch a été notifié{urgent ? ' en priorité' : ''}. Référence INC-{String(Math.floor(Math.random() * 900) + 100)}.</Text>
      </Box>
      <Button size="3" style={{ width: '100%', maxWidth: 260, minHeight: 48 }} onClick={() => go('missions')}>Retour aux missions</Button>
    </Flex>
  );

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Signaler un incident" sub="Transmis au dispatch" onBack={() => go('profil')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4" pb="8">
          <Box>
            <Text size="1" color="gray" weight="medium" mb="2" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Type d’incident</Text>
            <Grid columns="2" gap="2">
              {INCIDENT_TYPES.map((t) => {
                const on = type === t.id;
                return (
                  <Card key={t.id} size="2" onClick={() => setType(t.id)} style={{ cursor: 'pointer', border: on ? '1px solid var(--indigo-8)' : '1px solid var(--gray-a3)', background: on ? 'var(--indigo-a2)' : undefined }}>
                    <Flex align="center" gap="2"><Box style={{ color: on ? 'var(--indigo-11)' : 'var(--gray-10)' }}>{t.icon}</Box><Text size="2" weight={on ? 'medium' : 'regular'}>{t.label}</Text></Flex>
                  </Card>
                );
              })}
            </Grid>
          </Box>

          <Box>
            <Text size="1" color="gray" weight="medium" mb="2" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Gravité</Text>
            <SegmentedControl.Root value={sev} onValueChange={setSev} size="2" style={{ width: '100%' }}>
              {SEVERITY.map((s) => <SegmentedControl.Item key={s.id} value={s.id} style={{ flex: 1 }}>{s.label}</SegmentedControl.Item>)}
            </SegmentedControl.Root>
          </Box>

          {urgent && (
            <Callout.Root color="red">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>Incident urgent — en cas de danger immédiat, contactez les secours (15 / 19) puis le dispatch.</Callout.Text>
              <Box mt="2"><Button size="2" color="red" style={{ width: '100%', minHeight: 44 }}><MobileIcon /> Appeler le dispatch (urgence)</Button></Box>
            </Callout.Root>
          )}

          <Box>
            <Text size="1" color="gray" weight="medium" mb="2" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Description</Text>
            <TextArea placeholder="Décrivez ce qu’il s’est passé…" value={desc} onChange={(e) => setDesc(e.target.value)} size="2" style={{ minHeight: 90 }} />
          </Box>

          <Box>
            <Text size="1" color="gray" weight="medium" mb="2" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Photos (optionnel)</Text>
            <Flex gap="2">
              {[0, 1, 2].map((i) => (
                <Flex key={i} align="center" justify="center" style={{ width: 72, height: 72, borderRadius: 'var(--radius-3)', border: '1px dashed var(--gray-a6)', color: 'var(--gray-9)', cursor: 'pointer' }}><CameraIcon width="20" /></Flex>
              ))}
            </Flex>
          </Box>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <Button size="4" color={urgent ? 'red' : 'orange'} disabled={!type} onClick={() => setSent(true)} style={{ width: '100%', height: 52 }}><PaperPlaneIcon /> Envoyer le signalement</Button>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   Objectifs & primes (livreur)
   ========================================================================= */
function Objectives({ go }) {
  const met = GOALS.filter((g) => g.current >= g.target);
  const totalBonus = met.reduce((a, g) => a + g.bonus, 0);
  const maxBonus = GOALS.reduce((a, g) => a + g.bonus, 0);
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Objectifs & primes" sub={met.length + '/' + GOALS.length + ' objectifs atteints'} onBack={() => go('profil')} />
      <Box px="4" pt="3">
        <Card size="3" style={{ background: 'var(--grass-a3)' }}>
          <Flex direction="column" align="center" gap="1" py="1">
            <Text size="2" style={{ color: 'var(--grass-11)' }}>Prime acquise cette période</Text>
            <Heading size="8" style={{ color: 'var(--grass-11)', whiteSpace: 'nowrap' }}>{money(totalBonus).replace(',00 DH', ' DH')}</Heading>
            <Text size="1" style={{ color: 'var(--grass-11)' }}>sur {money(maxBonus).replace(',00 DH', ' DH')} possibles</Text>
          </Flex>
        </Card>
      </Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          {GOALS.map((g) => {
            const pct = Math.min(100, Math.round((g.current / (g.target || 1)) * 100));
            const done = g.current >= g.target;
            return (
              <Card key={g.id} size="2" style={{ border: done ? '1px solid var(--grass-a6)' : '1px solid var(--gray-a3)' }}>
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between">
                    <Flex align="center" gap="2">
                      <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: '50%', background: done ? 'var(--grass-9)' : 'var(--gray-a4)', color: done ? 'white' : 'var(--gray-10)', flex: '0 0 30px' }}>{done ? <CheckIcon /> : <TargetIcon width="15" />}</Flex>
                      <Box><Text as="div" size="2" weight="medium">{g.metric}</Text><Text as="div" size="1" color="gray">par {g.period}</Text></Box>
                    </Flex>
                    <Badge color={done ? 'grass' : 'gray'} variant="soft" radius="full">+{g.bonus} DH</Badge>
                  </Flex>
                  <Progress value={pct} color={done ? 'grass' : pct > 60 ? 'amber' : 'indigo'} />
                  <Flex justify="between"><Text size="1" color="gray">{g.current}{g.unit === '★' ? ' ★' : g.unit === '%' ? ' %' : ' ' + g.unit}</Text><Text size="1" color="gray">Objectif : {g.target}{g.unit === '★' ? ' ★' : g.unit === '%' ? ' %' : ' ' + g.unit}</Text></Flex>
                </Flex>
              </Card>
            );
          })}
          <Callout.Root color="gray" variant="surface" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Les objectifs et primes sont définis par votre transporteur.</Callout.Text></Callout.Root>
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/* =========================================================================
   Récap fin de journée · Support · Documents
   ========================================================================= */
function DayRecap({ go }) {
  const [closed, setClosed] = useState(false);
  const stats = [
    { label: 'Courses livrées', value: '7', icon: <CheckCircledIcon />, color: 'green' },
    { label: 'Échecs', value: '1', icon: <CrossCircledIcon />, color: 'red' },
    { label: 'Distance', value: '84 km', icon: <SewingPinFilledIcon />, color: 'indigo' },
    { label: 'Temps de conduite', value: '6,5 h', icon: <LapTimerIcon />, color: 'cyan' },
  ];
  if (closed) return (
    <Flex direction="column" align="center" justify="center" gap="4" style={{ height: '100%' }} px="5">
      <Flex align="center" justify="center" style={{ width: 68, height: 68, borderRadius: '50%', background: 'var(--green-a3)', color: 'var(--green-11)' }}><CheckIcon width="36" height="36" /></Flex>
      <Box style={{ textAlign: 'center' }}><Heading size="5" mb="1">Journée clôturée</Heading><Text size="2" color="gray">Bonne soirée, Youssef. Vos gains seront consolidés cette nuit.</Text></Box>
      <Button size="3" style={{ width: '100%', maxWidth: 260, minHeight: 48 }} onClick={() => go('profil')}>Retour au profil</Button>
    </Flex>
  );
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Récap du jour" sub="Samedi 12 juillet" onBack={() => go('profil')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          <Grid columns="2" gap="2">
            {stats.map((s) => (
              <Card key={s.label} size="2">
                <Flex align="center" gap="2" mb="1"><Box style={{ color: `var(--${s.color}-11)` }}>{s.icon}</Box><Text size="1" color="gray">{s.label}</Text></Flex>
                <Text size="6" weight="bold">{s.value}</Text>
              </Card>
            ))}
          </Grid>
          <Card size="2">
            <Text size="2" weight="bold" mb="2" as="div">Encaissement COD</Text>
            <Flex direction="column" gap="2">
              <Flex justify="between"><Text size="2" color="gray">Collecté aujourd’hui</Text><Text size="2" weight="medium">{money(5140)}</Text></Flex>
              <Flex justify="between"><Text size="2" color="gray">À déposer en agence</Text><Badge color="amber" variant="soft" radius="full">{money(3820)}</Badge></Flex>
            </Flex>
          </Card>
          <Card size="2" style={{ background: 'var(--grass-a3)' }}>
            <Flex justify="between" align="center"><Text size="2" style={{ color: 'var(--grass-11)' }}>Gains estimés du jour</Text><Heading size="6" style={{ color: 'var(--grass-11)' }}>{money(126).replace(',00 DH', ' DH')}</Heading></Flex>
          </Card>
          <Callout.Root color="amber" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Déposez le cash COD (3 820 DH) en agence avant de clôturer.</Callout.Text></Callout.Root>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <Button size="4" onClick={() => setClosed(true)} style={{ width: '100%', height: 52 }}><CheckIcon /> Clôturer ma journée</Button>
      </BottomAction>
    </Flex>
  );
}

function Support({ go }) {
  const [msgs, setMsgs] = useState([
    { from: 'them', txt: 'Bonjour Youssef, la CMD-…014 passe en priorité, le client attend.', time: '13:40' },
    { from: 'me', txt: 'Bien reçu, j’y suis dans 10 min.', time: '13:41' },
    { from: 'them', txt: 'Parfait, merci 👍', time: '13:41' },
  ]);
  const [txt, setTxt] = useState('');
  const send = () => { if (!txt.trim()) return; setMsgs((m) => [...m, { from: 'me', txt: txt.trim(), time: '13:45' }]); setTxt(''); };
  const quick = ['J’arrive', 'Retard 15 min', 'Adresse introuvable'];
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Support dispatch" sub="Dispatcher · Salma I." onBack={() => go('profil')} right={<Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)' }} />} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="2" p="4">
          {msgs.map((m, i) => (
            <Flex key={i} justify={m.from === 'me' ? 'end' : 'start'}>
              <Box style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: 'var(--radius-4)', background: m.from === 'me' ? 'var(--indigo-9)' : 'var(--gray-a3)', color: m.from === 'me' ? 'white' : 'var(--gray-12)' }}>
                <Text size="2" as="div">{m.txt}</Text>
                <Text size="1" as="div" style={{ opacity: 0.7, textAlign: 'end', marginTop: 2 }}>{m.time}</Text>
              </Box>
            </Flex>
          ))}
        </Flex>
      </ScrollArea>
      <Box px="3" pb="2"><Flex gap="2" wrap="wrap">{quick.map((q) => <Badge key={q} color="gray" variant="soft" radius="full" style={{ cursor: 'pointer' }} onClick={() => setMsgs((m) => [...m, { from: 'me', txt: q, time: '13:46' }])}>{q}</Badge>)}</Flex></Box>
      <Box style={{ padding: 'var(--space-3)', borderTop: '1px solid var(--gray-a4)', background: 'var(--color-panel-solid)' }}>
        <Flex gap="2" align="center">
          <TextField.Root size="3" placeholder="Message au dispatch…" value={txt} onChange={(e) => setTxt(e.target.value)} style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
          <IconButton size="3" onClick={send} disabled={!txt.trim()} style={{ width: 48, height: 44 }}><PaperPlaneIcon /></IconButton>
        </Flex>
      </Box>
    </Flex>
  );
}

function Documents({ go }) {
  const [docs, setDocs] = useState([
    { name: 'Permis de conduire', meta: 'A, B · exp. 09/2028', color: 'green', badge: 'Valide' },
    { name: 'Contrat freelance', meta: 'Signé le 02/01/2026', color: 'gray', badge: 'PDF' },
    { name: 'Carte grise — Moto 7890-B-12', meta: 'À jour', color: 'gray', badge: 'PDF' },
    { name: 'Attestation d’assurance', meta: 'Échéance 11/2026', color: 'green', badge: 'Valide' },
    { name: 'Contrôle technique', meta: 'Échéance dans 5 j', color: 'amber', badge: 'Bientôt' },
    { name: 'Attestation de travail', meta: 'Généré le 01/07/2026', color: 'gray', badge: 'PDF' },
  ]);
  const upload = () => { setDocs((d) => [...d, { name: 'Nouveau document', meta: 'Téléversé à l’instant', color: 'amber', badge: 'En vérification' }]); toast('Document téléversé · en vérification', { icon: 'info', color: 'amber' }); };
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Mes documents" sub={docs.length + ' documents'} onBack={() => go('profil')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="2" p="4" pb="8">
          {docs.map((d, i) => (
            <Card key={d.name + i} size="2">
              <Flex align="center" justify="between" gap="3">
                <Flex align="center" gap="3" style={{ minWidth: 0 }}>
                  <Flex align="center" justify="center" style={{ width: 38, height: 38, borderRadius: 'var(--radius-3)', flex: '0 0 38px', background: 'var(--gray-a3)', color: 'var(--gray-11)' }}><ArchiveIcon width="18" /></Flex>
                  <Box style={{ minWidth: 0 }}><Text as="div" size="2" weight="medium" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</Text><Text as="div" size="1" color="gray">{d.meta}</Text></Box>
                </Flex>
                <Flex align="center" gap="2" style={{ flex: '0 0 auto' }}>
                  <Badge color={d.color} variant="soft" radius="full" size="1">{d.badge}</Badge>
                  <IconButton size="2" variant="soft" color="gray" onClick={() => toast('Téléchargement de « ' + d.name + ' »', { icon: 'download' })}><ArrowDownIcon /></IconButton>
                </Flex>
              </Flex>
            </Card>
          ))}
          <Button size="3" variant="soft" mt="1" style={{ minHeight: 48 }} onClick={upload}><PlusIcon /> Téléverser un document</Button>
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/* =========================================================================
   Onboarding / recrutement livreur (avant le premier shift)
   ========================================================================= */
const ONB_DOCS = [
  { id: 'permis_r', name: 'Permis de conduire (recto)', status: 'valid' },
  { id: 'permis_v', name: 'Permis de conduire (verso)', status: 'review' },
  { id: 'grise', name: 'Carte grise', status: 'todo' },
  { id: 'assur', name: 'Attestation d’assurance', status: 'refused' },
];
const DOC_STATUS = {
  todo: { label: 'À fournir', color: 'gray', icon: <PlusIcon /> },
  review: { label: 'En vérification', color: 'amber', icon: <ClockIcon /> },
  valid: { label: 'Validé', color: 'green', icon: <CheckIcon /> },
  refused: { label: 'Refusé', color: 'red', icon: <Cross2Icon /> },
};
function Onboarding({ go }) {
  const [step, setStep] = useState(1);
  const [contract, setContract] = useState('freelance');
  const [vehicle, setVehicle] = useState('moto');
  const [docs, setDocs] = useState(ONB_DOCS);
  const upload = (id) => setDocs((d) => d.map((x) => x.id === id ? { ...x, status: 'review' } : x));
  const total = 4;

  const stepHead = (
    <Box px="4" pt="3">
      <Flex gap="1" mb="2">
        {[1, 2, 3, 4].map((n) => <Box key={n} style={{ flex: 1, height: 4, borderRadius: 2, background: n <= step ? 'var(--indigo-9)' : 'var(--gray-a4)' }} />)}
      </Flex>
      <Text size="1" color="gray">Étape {step} / {total}</Text>
    </Box>
  );

  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Devenir livreur" sub="Inscription" onBack={step > 1 ? () => setStep(step - 1) : () => go('login')} />
      {step < 4 && stepHead}
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4" pb="8">
          {step === 1 && (
            <>
              <Heading size="4">Vos informations</Heading>
              <Box><Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Nom complet</Text><TextField.Root size="3" defaultValue="Mehdi Alaoui" /></Box>
              <Box><Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Téléphone</Text><TextField.Root size="3" defaultValue="+212 6 " placeholder="+212 6 •• •• •• ••"><TextField.Slot><MobileIcon /></TextField.Slot></TextField.Root></Box>
              <Box><Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Ville de rattachement</Text>
                <Select.Root defaultValue="Casablanca" size="3"><Select.Trigger style={{ width: '100%' }} /><Select.Content>{['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès'].map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content></Select.Root>
              </Box>
            </>
          )}

          {step === 2 && (
            <>
              <Heading size="4">Contrat & véhicule</Heading>
              <Box>
                <Text size="2" weight="medium" mb="2" as="div">Type de contrat</Text>
                <Grid columns="2" gap="2">
                  {[{ id: 'salarie', t: 'Salarié', d: 'Rémunération fixe' }, { id: 'freelance', t: 'Freelance', d: 'Payé à la course' }].map((c) => {
                    const on = contract === c.id;
                    return <Card key={c.id} onClick={() => setContract(c.id)} style={{ cursor: 'pointer', border: on ? '1px solid var(--indigo-8)' : '1px solid var(--gray-a3)', background: on ? 'var(--indigo-a2)' : undefined }}><Flex direction="column" gap="1"><Flex justify="between" align="center"><Text size="2" weight="medium">{c.t}</Text>{on && <CheckCircledIcon color="var(--indigo-11)" />}</Flex><Text size="1" color="gray">{c.d}</Text></Flex></Card>;
                  })}
                </Grid>
              </Box>
              <Box>
                <Text size="2" weight="medium" mb="2" as="div">Véhicule</Text>
                <SegmentedControl.Root value={vehicle} onValueChange={setVehicle} size="2" style={{ width: '100%' }}>
                  <SegmentedControl.Item value="moto" style={{ flex: 1 }}>Moto</SegmentedControl.Item>
                  <SegmentedControl.Item value="voiture" style={{ flex: 1 }}>Voiture</SegmentedControl.Item>
                  <SegmentedControl.Item value="fourgon" style={{ flex: 1 }}>Fourgon</SegmentedControl.Item>
                </SegmentedControl.Root>
              </Box>
              {contract === 'freelance' && <Callout.Root color="cyan" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>En freelance, vos gains sont calculés par course livrée et suivis dans « Historique & gains ».</Callout.Text></Callout.Root>}
            </>
          )}

          {step === 3 && (
            <>
              <Heading size="4">Vos documents</Heading>
              <Text size="2" color="gray">Téléversez vos pièces justificatives. Elles seront vérifiées sous 48 h.</Text>
              <Flex direction="column" gap="2">
                {docs.map((d) => {
                  const st = DOC_STATUS[d.status];
                  return (
                    <Card key={d.id} size="2">
                      <Flex align="center" justify="between" gap="3">
                        <Flex align="center" gap="3" style={{ minWidth: 0 }}>
                          <Flex align="center" justify="center" style={{ width: 36, height: 36, borderRadius: 'var(--radius-3)', flex: '0 0 36px', background: `var(--${st.color}-a3)`, color: `var(--${st.color}-11)` }}>{st.icon}</Flex>
                          <Box style={{ minWidth: 0 }}><Text as="div" size="2" weight="medium">{d.name}</Text><Badge color={st.color} variant="soft" radius="full" size="1">{st.label}</Badge></Box>
                        </Flex>
                        {(d.status === 'todo' || d.status === 'refused') && <Button size="2" variant="soft" onClick={() => upload(d.id)} style={{ flex: '0 0 auto', minHeight: 40 }}><CameraIcon /> {d.status === 'refused' ? 'Reprendre' : 'Ajouter'}</Button>}
                      </Flex>
                      {d.status === 'refused' && <Text size="1" color="red" mt="2" as="div">Document illisible — merci de reprendre la photo.</Text>}
                    </Card>
                  );
                })}
              </Flex>
            </>
          )}

          {step === 4 && (
            <Flex direction="column" align="center" justify="center" gap="4" style={{ minHeight: 480, textAlign: 'center' }}>
              <Flex align="center" justify="center" style={{ width: 76, height: 76, borderRadius: '50%', background: 'var(--amber-a3)', color: 'var(--amber-11)' }}><ClockIcon width="38" height="38" /></Flex>
              <Box>
                <Heading size="5" mb="2">Dossier en cours de vérification</Heading>
                <Text size="2" color="gray">Merci Mehdi ! Votre dossier est complet et en cours de revue par notre équipe. Vous recevrez une notification dès sa validation (sous 48 h) et pourrez alors démarrer votre premier shift.</Text>
              </Box>
              <Card size="2" style={{ width: '100%' }}>
                <Flex direction="column" gap="2">
                  <Flex justify="between"><Text size="2" color="gray">Contrat</Text><Text size="2" weight="medium">{contract === 'salarie' ? 'Salarié' : 'Freelance'}</Text></Flex>
                  <Flex justify="between"><Text size="2" color="gray">Véhicule</Text><Text size="2" weight="medium" style={{ textTransform: 'capitalize' }}>{vehicle}</Text></Flex>
                  <Flex justify="between"><Text size="2" color="gray">Documents</Text><Badge color="amber" variant="soft" radius="full">3/4 en vérification</Badge></Flex>
                </Flex>
              </Card>
            </Flex>
          )}
        </Flex>
      </ScrollArea>
      <BottomAction>
        {step < 4
          ? <Button size="4" onClick={() => setStep(step + 1)} style={{ width: '100%', height: 52 }}>Continuer <ArrowRightIcon /></Button>
          : <Button size="4" variant="soft" onClick={() => go('login')} style={{ width: '100%', height: 52 }}>Revenir à l’accueil</Button>}
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   Ma caisse (intégrée au flux — cash en main, plafond, dépôt)
   ========================================================================= */
function MaCaisse({ go }) {
  const [deposited, setDeposited] = useState(false);
  const inHand = deposited ? 0 : 3820;
  const cap = 6000;
  const pct = Math.round((inHand / cap) * 100);
  const color = pct > 85 ? 'red' : pct > 60 ? 'amber' : 'green';
  const collected = [
    { ref: 'CMD-…088', who: 'Salma Idrissi', amt: 1250, at: '13:42' },
    { ref: 'CMD-…091', who: 'Mehdi Tahiri', amt: 680, at: '12:20' },
    { ref: 'CMD-…095', who: 'Imane Ouazzani', amt: 900, at: '11:05' },
    { ref: 'CMD-…099', who: 'Fatima Zahra', amt: 990, at: '10:12' },
  ];
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Ma caisse" sub="Cash à encaisser & dépôt" onBack={() => go('profil')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          <Card size="3" style={{ background: `var(--${color}-a3)` }}>
            <Flex direction="column" align="center" gap="1" py="2">
              <Text size="2" style={{ color: `var(--${color}-11)` }}>Cash en main</Text>
              <Heading size="8" style={{ color: `var(--${color}-11)`, whiteSpace: 'nowrap' }}>{money(inHand).replace(',00 DH', ' DH')}</Heading>
              <Text size="1" style={{ color: `var(--${color}-11)` }}>depuis le dernier dépôt</Text>
            </Flex>
          </Card>

          <Card size="2">
            <Flex justify="between" mb="1"><Text size="2" color="gray">Plafond de cash</Text><Text size="2" weight="medium">{money(inHand).replace(',00 DH', '')} / {money(cap).replace(',00 DH', ' DH')}</Text></Flex>
            <Progress value={pct} color={color} size="3" />
            {pct > 60 && !deposited && <Callout.Root color="amber" size="1" mt="2"><Callout.Icon><ExclamationTriangleIcon /></Callout.Icon><Callout.Text>Proche du plafond — pensez à déposer.</Callout.Text></Callout.Root>}
          </Card>

          {!deposited && (
            <Box>
              <Text as="div" size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Encaissé depuis le dépôt</Text>
              <Flex direction="column" gap="2">
                {collected.map((c) => (
                  <Card key={c.ref} size="2"><Flex align="center" justify="between"><Flex align="center" gap="3"><Flex align="center" justify="center" style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--green-a3)', color: 'var(--green-11)' }}><ArrowDownIcon /></Flex><Box><Text as="div" size="2" weight="medium">{c.who}</Text><Text as="div" size="1" color="gray">{c.ref} · {c.at}</Text></Box></Flex><Text size="3" weight="bold" style={{ color: 'var(--green-11)' }}>+{money(c.amt).replace(',00 DH', ' DH')}</Text></Flex></Card>
                ))}
              </Flex>
            </Box>
          )}
          {deposited && <Callout.Root color="green"><Callout.Icon><CheckCircledIcon /></Callout.Icon><Callout.Text>Dépôt de {money(3820)} enregistré. Bordereau <strong>BRD-20260712-07</strong> généré. Votre caisse est repartie à zéro.</Callout.Text></Callout.Root>}
        </Flex>
      </ScrollArea>
      <BottomAction>
        <AlertDialog.Root>
          <AlertDialog.Trigger><Button size="4" disabled={inHand === 0} color={color === 'green' ? 'indigo' : color} style={{ width: '100%', height: 52 }}><BackpackIcon /> Déposer en agence</Button></AlertDialog.Trigger>
          <AlertDialog.Content maxWidth="330px">
            <AlertDialog.Title>Déposer {money(inHand)} ?</AlertDialog.Title>
            <AlertDialog.Description size="2">Un bordereau de dépôt sera généré. Votre caisse repassera à 0 après validation en agence.</AlertDialog.Description>
            <Flex gap="3" mt="4" justify="end"><AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel><AlertDialog.Action><Button color="green" onClick={() => setDeposited(true)}>Générer le bordereau</Button></AlertDialog.Action></Flex>
          </AlertDialog.Content>
        </AlertDialog.Root>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   Paramètres · Aide / FAQ
   ========================================================================= */
function SettingRow({ icon, label, hint, control }) {
  return (
    <Flex align="center" justify="between" gap="3" py="3" px="1" style={{ borderBottom: '1px solid var(--gray-a3)' }}>
      <Flex align="center" gap="3" style={{ minWidth: 0 }}>
        <Box style={{ color: 'var(--gray-9)', flex: '0 0 auto' }}>{icon}</Box>
        <Box style={{ minWidth: 0 }}><Text as="div" size="2" weight="medium">{label}</Text>{hint && <Text as="div" size="1" color="gray">{hint}</Text>}</Box>
      </Flex>
      <Box style={{ flex: '0 0 auto' }}>{control}</Box>
    </Flex>
  );
}
function Settings({ go }) {
  const [push, setPush] = useState(true);
  const [sound, setSound] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [auto, setAuto] = useState(false);
  const [lang, setLang] = useState('fr');
  const [theme, setTheme] = useState('light');
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Paramètres" onBack={() => go('profil')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4" pb="8">
          <Box>
            <Text size="1" color="gray" weight="medium" mb="1" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Notifications</Text>
            <Card size="2"><Flex direction="column">
              <SettingRow icon={<BellIcon />} label="Notifications push" hint="Missions, annulations, alertes" control={<Switch checked={push} onCheckedChange={setPush} />} />
              <SettingRow icon={<ChatBubbleIcon />} label="Son" control={<Switch checked={sound} onCheckedChange={setSound} />} />
              <SettingRow icon={<UpdateIcon />} label="Vibration" control={<Switch checked={vibrate} onCheckedChange={setVibrate} />} />
            </Flex></Card>
          </Box>
          <Box>
            <Text size="1" color="gray" weight="medium" mb="1" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Affichage</Text>
            <Card size="2"><Flex direction="column">
              <SettingRow icon={<GlobeIcon />} label="Langue" control={<SegmentedControl.Root size="1" value={lang} onValueChange={setLang}><SegmentedControl.Item value="fr">FR</SegmentedControl.Item><SegmentedControl.Item value="ar">AR</SegmentedControl.Item></SegmentedControl.Root>} />
              <SettingRow icon={theme === 'dark' ? <MoonIcon /> : <SunIcon />} label="Thème" control={<SegmentedControl.Root size="1" value={theme} onValueChange={setTheme}><SegmentedControl.Item value="light">Clair</SegmentedControl.Item><SegmentedControl.Item value="dark">Sombre</SegmentedControl.Item></SegmentedControl.Root>} />
            </Flex></Card>
          </Box>
          <Box>
            <Text size="1" color="gray" weight="medium" mb="1" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Missions</Text>
            <Card size="2"><Flex direction="column">
              <SettingRow icon={<CheckCircledIcon />} label="Acceptation automatique" hint="Accepter les missions de ma zone" control={<Switch checked={auto} onCheckedChange={setAuto} />} />
              <SettingRow icon={<SewingPinFilledIcon />} label="Partage de position" hint="Actif pendant le shift" control={<Badge color="green" variant="soft" radius="full">Actif</Badge>} />
            </Flex></Card>
          </Box>
          <Box>
            <Text size="1" color="gray" weight="medium" mb="1" as="div" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>À propos</Text>
            <Card size="2"><Flex direction="column">
              <SettingRow icon={<InfoCircledIcon />} label="Version" control={<Text size="2" color="gray">2.4.1</Text>} />
              <SettingRow icon={<LockClosedIcon />} label="Confidentialité (Loi 09-08)" control={<ChevronRightIcon color="var(--gray-8)" />} />
            </Flex></Card>
          </Box>
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

const FAQ = [
  { q: 'Comment accepter une mission ?', a: 'Ouvrez l’onglet Missions, sélectionnez la mission puis appuyez sur « Naviguer » pour démarrer. Vous pouvez activer l’acceptation automatique dans Paramètres.' },
  { q: 'Que faire si le client est absent ?', a: 'Appelez le client via le bouton Contact. Sans réponse, signalez un échec en choisissant « Destinataire absent » ; la commande pourra être reprogrammée.' },
  { q: 'Comment encaisser le COD ?', a: 'Sur l’écran de livraison, saisissez le montant reçu. Le cash collecté apparaît dans Ma caisse ; déposez-le en agence avant le plafond.' },
  { q: 'Quand suis-je obligé de faire une pause ?', a: 'Selon la règle EU 561/2006, après 4h30 de conduite, une pause de 45 min est requise. L’app vous alerte 30 min avant.' },
  { q: 'Comment sont calculées mes primes ?', a: 'Les objectifs et primes sont définis par votre transporteur. Suivez votre progression dans Profil › Objectifs & primes.' },
  { q: 'Je n’ai pas de réseau, que se passe-t-il ?', a: 'L’app fonctionne hors-ligne : vos actions sont mises en file et synchronisées automatiquement dès le retour du réseau.' },
];
function Help({ go }) {
  const [open, setOpen] = useState(0);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const list = query ? FAQ.filter((item) => (item.q + ' ' + item.a).toLowerCase().includes(query)) : FAQ;
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Aide / FAQ" onBack={() => go('profil')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          <TextField.Root size="3" placeholder="Rechercher une question…" value={q} onChange={(e) => setQ(e.target.value)}><TextField.Slot><QuestionMarkCircledIcon /></TextField.Slot>{q && <TextField.Slot side="right"><IconButton size="1" variant="ghost" color="gray" onClick={() => setQ('')}><Cross2Icon /></IconButton></TextField.Slot>}</TextField.Root>
          <Flex direction="column" gap="2">
            {list.length === 0 && <Text size="2" color="gray" align="center" mt="4">Aucune question ne correspond à « {q} ».</Text>}
            {list.map((item, i) => {
              const on = open === i;
              return (
                <Card key={item.q} size="2" onClick={() => setOpen(on ? -1 : i)} style={{ cursor: 'pointer' }}>
                  <Flex align="center" justify="between" gap="3">
                    <Text size="2" weight="medium">{item.q}</Text>
                    <Box style={{ flex: '0 0 auto', transform: on ? 'rotate(180deg)' : 'none', transition: 'transform .15s', color: 'var(--gray-9)' }}><ChevronDownIcon /></Box>
                  </Flex>
                  {on && <Text size="2" color="gray" as="div" mt="2">{item.a}</Text>}
                </Card>
              );
            })}
          </Flex>
          <Card size="2" style={{ background: 'var(--indigo-a3)' }}>
            <Flex align="center" justify="between" gap="3">
              <Box><Text as="div" size="2" weight="medium">Besoin d’aide ?</Text><Text as="div" size="1" color="gray">Contactez le dispatch directement</Text></Box>
              <Button size="2" onClick={() => go('support')}><ChatBubbleIcon /> Contacter</Button>
            </Flex>
          </Card>
        </Flex>
      </ScrollArea>
    </Flex>
  );
}

/* =========================================================================
   Profil livreur
   ========================================================================= */
function Profil({ go }) {
  const [avail, setAvail] = useState(true);
  const rows = [
    { icon: <CubeIcon />, label: 'Véhicule', value: 'Moto · 7890-B-12' },
    { icon: <PersonIcon />, label: 'Permis', value: 'A, B · exp. 09/2028', badge: { c: 'green', t: 'Valide' } },
    { icon: <SewingPinFilledIcon />, label: 'Zone assignée', value: 'Casablanca — Maârif' },
    { icon: <LapTimerIcon />, label: 'Conduite (EU 561)', value: '6,5 h / 9 h' },
    { icon: <ClockIcon />, label: 'Horaire du jour', value: '08:00 – 17:00' },
  ];
  const cInfo = DRIVER_CONTRACT === 'FREELANCE' ? { c: 'violet', t: 'Freelance · ' + DRIVER_RATE + ' DH/course' } : { c: 'blue', t: 'Salarié' };
  return (
    <ScrollArea style={{ height: '100%' }}>
      <Flex direction="column" style={{ minHeight: '100%' }}>
        <ScreenHead title="Mon profil" sub="Livreur · Transpo" />
        <Flex direction="column" gap="3" p="4">
          <Flex align="center" gap="3">
            <Avatar size="6" radius="full" fallback="YB" color="indigo" />
            <Box>
              <Text as="div" size="5" weight="bold">Youssef Benali</Text>
              <Text as="div" size="2" color="gray">+212 6 12 34 56 78</Text>
              <Flex align="center" gap="2" mt="1"><Badge color="green" variant="soft" radius="full">★ 4,8</Badge><Badge color={cInfo.c} variant="soft" radius="full">{cInfo.t}</Badge></Flex>
            </Box>
          </Flex>

          <Card size="2">
            <Flex align="center" justify="between">
              <Box><Text as="div" size="2" weight="medium">Disponible</Text><Text as="div" size="1" color="gray">{avail ? 'Vous recevez des missions' : 'Hors ligne — aucune mission'}</Text></Box>
              <Switch size="3" checked={avail} onCheckedChange={setAvail} />
            </Flex>
          </Card>

          <Card size="1">
            <Flex direction="column">
              {rows.map((r, i) => (
                <Flex key={r.label} align="center" justify="between" py="3" px="1" style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--gray-a3)' : 'none' }}>
                  <Flex align="center" gap="3"><Box style={{ color: 'var(--gray-9)' }}>{r.icon}</Box><Text size="2" color="gray">{r.label}</Text></Flex>
                  <Flex align="center" gap="2"><Text size="2" weight="medium">{r.value}</Text>{r.badge && <Badge color={r.badge.c} variant="soft" radius="full" size="1">{r.badge.t}</Badge>}</Flex>
                </Flex>
              ))}
            </Flex>
          </Card>

          <Grid columns="2" gap="3">
            <Button size="3" variant="soft" onClick={() => go('earnings')} style={{ minHeight: 48 }}><ArchiveIcon /> Historique & gains</Button>
            <Button size="3" variant="soft" onClick={() => go('objectives')} style={{ minHeight: 48 }}><TargetIcon /> Objectifs & primes</Button>
          </Grid>
          <Grid columns="2" gap="3">
            <Button size="3" variant="soft" onClick={() => go('recap')} style={{ minHeight: 48 }}><CheckCircledIcon /> Récap du jour</Button>
            <Button size="3" variant="soft" onClick={() => go('support')} style={{ minHeight: 48 }}><ChatBubbleIcon /> Support dispatch</Button>
          </Grid>
          <Button size="3" variant="soft" onClick={() => go('docs')} style={{ minHeight: 48, width: '100%' }}><ArchiveIcon /> Mes documents</Button>
          <Grid columns="2" gap="3">
            <Button size="3" variant="soft" color="gray" onClick={() => go('settings')} style={{ minHeight: 48 }}><GearIcon /> Paramètres</Button>
            <Button size="3" variant="soft" color="gray" onClick={() => go('help')} style={{ minHeight: 48 }}><QuestionMarkCircledIcon /> Aide / FAQ</Button>
          </Grid>
          <Button size="3" variant="soft" onClick={() => go('macaisse')} style={{ minHeight: 48, width: '100%' }}><BackpackIcon /> Ma caisse</Button>
          <Button size="3" variant="soft" onClick={() => go('shift')} style={{ minHeight: 48, width: '100%' }}><LapTimerIcon /> Mon shift</Button>
          <Button size="3" variant="soft" color="orange" onClick={() => go('incident')} style={{ minHeight: 48 }}><ExclamationTriangleIcon /> Signaler un incident</Button>
          <Button size="3" variant="soft" color="red" onClick={() => go('login')} style={{ minHeight: 48 }}><ExitIcon /> Se déconnecter</Button>
        </Flex>
      </Flex>
    </ScrollArea>
  );
}

function Done({ go }) {
  return (
    <Flex direction="column" align="center" justify="center" gap="4" style={{ height: '100%' }} px="5">
      <Flex align="center" justify="center" style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--green-a3)', color: 'var(--green-11)' }}><CheckIcon width="48" height="48" /></Flex>
      <Box style={{ textAlign: 'center' }}>
        <Heading size="7">Livraison réussie</Heading>
        <Text size="2" color="gray">CMD-20260712-014 · {money(1250)} encaissés</Text>
      </Box>
      <Card size="2" style={{ width: '100%' }}>
        <Flex justify="between"><Text size="2" color="gray">Preuve</Text><Text size="2">2 photos + signature</Text></Flex>
        <Separator size="4" my="2" />
        <Flex justify="between"><Text size="2" color="gray">Prochaine mission</Text><Text size="2" weight="medium">CMD-…009 · 6,8 km</Text></Flex>
      </Card>
      <Box style={{ width: '100%' }}>
        <PrimaryBtn onClick={() => go('missions')}>Mission suivante</PrimaryBtn>
      </Box>
    </Flex>
  );
}

/* =========================================================================
   14 — Échec de livraison
   ========================================================================= */
const REASONS = ['Destinataire absent', 'Adresse introuvable', 'Refus du colis', 'Téléphone injoignable', 'Colis endommagé', 'Autre motif'];

function Fail({ go }) {
  const [reason, setReason] = useState('Destinataire absent');
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <ScreenHead title="Échec de livraison" sub="CMD-20260712-014" onBack={() => go('status')} />
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4" pb="8">
          <Callout.Root color="red" variant="surface"><Callout.Icon><ExclamationTriangleIcon /></Callout.Icon><Callout.Text>Indiquez un motif normalisé. La commande passera en <strong>retour</strong>.</Callout.Text></Callout.Root>
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">Motif <Text color="red">*</Text></Text>
            <RadioGroup.Root value={reason} onValueChange={setReason}>
              <Flex direction="column" gap="2">
                {REASONS.map((r) => (
                  <Card key={r} size="1" onClick={() => setReason(r)} style={{ cursor: 'pointer', border: reason === r ? '1px solid var(--indigo-7)' : '1px solid var(--gray-a3)' }}>
                    <Flex align="center" gap="3" py="1"><RadioGroup.Item value={r} /><Text size="2">{r}</Text></Flex>
                  </Card>
                ))}
              </Flex>
            </RadioGroup.Root>
          </Box>
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">Notes complémentaires</Text>
            <TextArea size="2" placeholder="Précisez le contexte (ex. : 2 appels sans réponse à 13h05 et 13h20)" style={{ minHeight: 90 }} />
          </Box>
          <Box>
            <Text size="2" weight="medium" mb="2" as="div">Photo justificative <Text size="1" color="gray">(optionnel)</Text></Text>
            <Flex direction="column" align="center" justify="center" gap="1" style={{ height: 96, borderRadius: 'var(--radius-3)', border: '1.5px dashed var(--gray-a6)', color: 'var(--gray-10)' }}><CameraIcon width="22" /><Text size="1">Ajouter une photo</Text></Flex>
          </Box>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <AlertDialog.Root>
          <AlertDialog.Trigger><PrimaryBtn color="red"><UpdateIcon /> Passer en retour</PrimaryBtn></AlertDialog.Trigger>
          <ConfirmContent title="Confirmer l’échec ?" desc={`Motif : « ${reason} ». La commande sera renvoyée vers le marchand.`} onOk={() => go('missions')} okLabel="Confirmer le retour" okColor="red" />
        </AlertDialog.Root>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   15 — Shift (EU 561/2006)
   ========================================================================= */
function Shift({ go }) {
  const [active, setActive] = useState(true);
  const driven = 6.5, maxDrive = 9, remaining = maxDrive - driven;
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      <Box px="4" pt="3" pb="2"><Heading size="6">Mon shift</Heading><Text size="1" color="gray">Samedi 12 juillet</Text></Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          <Card size="3">
            <Flex justify="between" align="center">
              <Box>
                <Flex align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50%', background: active ? 'var(--green-9)' : 'var(--gray-8)' }} /><Text size="3" weight="bold">{active ? 'Shift en cours' : 'Hors service'}</Text></Flex>
                <Text size="1" color="gray" ml="4">{active ? 'Démarré à 07:30' : 'Aucun shift actif'}</Text>
              </Box>
              <Switch size="3" checked={active} onCheckedChange={setActive} />
            </Flex>
          </Card>

          <Card size="2">
            <Flex align="center" gap="2" mb="2"><GlobeIcon color="var(--indigo-9)" /><Text size="2" weight="medium">Zone assignée</Text></Flex>
            <Flex align="center" justify="between"><Text size="3" weight="medium">Casa Centre</Text><Badge color="indigo" variant="soft">Maârif</Badge></Flex>
          </Card>

          <Card size="2">
            <Flex align="center" justify="between" mb="3">
              <Flex align="center" gap="2"><LapTimerIcon color="var(--indigo-9)" /><Text size="2" weight="medium">Temps de conduite</Text></Flex>
              <Tooltip content="Règlement européen EU 561/2006"><Badge color="gray" variant="soft" size="1">EU 561/2006</Badge></Tooltip>
            </Flex>
            <Flex justify="between" mb="1"><Text size="1" color="gray">Conduite du jour</Text><Text size="1" weight="medium">{driven}h / {maxDrive}h</Text></Flex>
            <Progress value={(driven / maxDrive) * 100} color={remaining < 1 ? 'red' : remaining < 2 ? 'amber' : 'green'} size="3" />
            <Flex justify="between" mt="3">
              <StatMini label="Restant" value={`${remaining.toFixed(1)}h`} color={remaining < 1 ? 'red' : 'amber'} />
              <StatMini label="Pause cumulée" value="45 min" />
              <StatMini label="Amplitude" value="9h30" />
            </Flex>
            {remaining < 2 && (
              <Callout.Root color="amber" size="1" mt="3"><Callout.Icon><ClockIcon /></Callout.Icon><Callout.Text>Pause obligatoire de 45 min avant d’atteindre la limite de conduite.</Callout.Text></Callout.Root>
            )}
          </Card>

          <Card size="2">
            <Text size="2" weight="medium" mb="2" as="div">Journée</Text>
            <Flex justify="between" mb="1"><Text size="2" color="gray">Missions livrées</Text><Text size="2" weight="medium">7</Text></Flex>
            <Flex justify="between" mb="1"><Text size="2" color="gray">Distance parcourue</Text><Text size="2" weight="medium">84,2 km</Text></Flex>
            <Flex justify="between"><Text size="2" color="gray">COD encaissé</Text><Text size="2" weight="medium" style={{ color: 'var(--green-11)' }}>{money(5140)}</Text></Flex>
          </Card>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <PrimaryBtn color={active ? 'red' : 'green'} variant={active ? 'soft' : 'solid'} onClick={() => setActive(!active)}>
          {active ? <><ExitIcon /> Terminer le shift</> : <>Démarrer le shift</>}
        </PrimaryBtn>
      </BottomAction>
    </Flex>
  );
}

function StatMini({ label, value, color }) {
  return <Box style={{ textAlign: 'center', flex: 1 }}><Text as="div" size="4" weight="bold" style={color ? { color: `var(--${color}-11)` } : undefined}>{value}</Text><Text as="div" size="1" color="gray">{label}</Text></Box>;
}

/* =========================================================================
   16 — État hors-ligne
   ========================================================================= */
function Offline({ go }) {
  const [syncing, setSyncing] = useState(false);
  const QUEUE = [
    { ref: 'CMD-20260712-014', act: 'Livraison + preuve (2 photos, signature)', icon: CheckCircledIcon, color: 'green' },
    { ref: 'CMD-20260712-014', act: 'Encaissement COD 1 250,00 DH', icon: ArchiveIcon, color: 'amber' },
    { ref: 'CMD-20260712-021', act: 'Statut → Récupérée', icon: UpdateIcon, color: 'violet' },
  ];
  return (
    <Flex direction="column" style={{ height: '100%' }}>
      {/* Bandeau hors-ligne */}
      <Flex align="center" gap="2" px="4" py="2" style={{ background: 'var(--amber-9)', color: 'var(--amber-12)' }}>
        <ExclamationTriangleIcon />
        <Text size="2" weight="medium" style={{ flex: 1 }}>Hors ligne — actions enregistrées localement</Text>
      </Flex>
      <Box px="4" pt="3" pb="2"><Heading size="6">Synchronisation</Heading><Text size="1" color="gray">Couverture réseau faible dans cette zone</Text></Box>
      <ScrollArea style={{ flex: 1 }}>
        <Flex direction="column" gap="3" p="4" pb="8">
          <Card size="2" style={{ background: 'var(--amber-a2)' }}>
            <Flex align="center" gap="3">
              <Flex align="center" justify="center" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--amber-a4)', color: 'var(--amber-11)' }}>
                {syncing ? <Spinner size="3" /> : <Text size="5" weight="bold">{QUEUE.length}</Text>}
              </Flex>
              <Box style={{ flex: 1 }}>
                <Text as="div" size="3" weight="medium">{syncing ? 'Synchronisation…' : `${QUEUE.length} actions en attente`}</Text>
                <Text as="div" size="1" color="gray">{syncing ? 'Envoi dès que le réseau revient' : 'Seront envoyées automatiquement'}</Text>
              </Box>
            </Flex>
          </Card>

          <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>File d’attente</Text>
          {QUEUE.map((q, i) => (
            <Card key={i} size="2">
              <Flex align="center" gap="3">
                <Box style={{ color: `var(--${q.color}-11)` }}><q.icon width="20" /></Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text as="div" size="2" weight="medium">{q.act}</Text>
                  <Text as="div" size="1" color="gray">{q.ref}</Text>
                </Box>
                {syncing ? <Spinner /> : <Badge color="gray" variant="soft" size="1"><ClockIcon width="11" /> En file</Badge>}
              </Flex>
            </Card>
          ))}

          <Callout.Root color="gray" variant="surface" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Vous pouvez continuer à travailler : chaque action est horodatée et conservée jusqu’au retour du réseau.</Callout.Text></Callout.Root>
        </Flex>
      </ScrollArea>
      <BottomAction>
        <PrimaryBtn variant="soft" disabled={syncing} onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 2200); }}>
          {syncing ? <><Spinner /> Synchronisation…</> : <><ReloadIcon /> Forcer la synchronisation</>}
        </PrimaryBtn>
      </BottomAction>
    </Flex>
  );
}

/* =========================================================================
   Harnais : cadre téléphone + sélecteur d'écrans
   ========================================================================= */
const SCREEN_LIST = [
  { id: 'login', label: '8 · Connexion & permissions', tabs: false },
  { id: 'missions', label: '9 · Missions du jour', tabs: true, tab: 'missions' },
  { id: 'route', label: '↳ Ma tournée (multi-arrêts)', tabs: true, tab: 'route' },
  { id: 'notifs', label: '↳ Notifications', tabs: true, tab: 'missions' },
  { id: 'scan', label: '↳ Scanner de colis', tabs: true, tab: 'scan' },
  { id: 'detail', label: '10 · Détail de mission', tabs: false },
  { id: 'status', label: '11 · Mise à jour de statut', tabs: false },
  { id: 'proof', label: '12 · Preuve de livraison', tabs: false },
  { id: 'cod', label: '13 · Encaissement COD', tabs: false },
  { id: 'fail', label: '14 · Échec de livraison', tabs: false },
  { id: 'shift', label: '15 · Shift (EU 561)', tabs: true, tab: 'shift' },
  { id: 'offline', label: '16 · État hors-ligne', tabs: false },
  { id: 'done', label: '↳ Confirmation livraison', tabs: false },
  { id: 'profil', label: '↳ Mon profil', tabs: true, tab: 'profil' },
  { id: 'earnings', label: '↳ Historique & gains', tabs: false },
  { id: 'incident', label: '↳ Signalement d’incident', tabs: false },
  { id: 'objectives', label: '↳ Objectifs & primes', tabs: false },
  { id: 'recap', label: '↳ Récap fin de journée', tabs: false },
  { id: 'support', label: '↳ Support / chat dispatch', tabs: false },
  { id: 'docs', label: '↳ Mes documents', tabs: false },
  { id: 'macaisse', label: '↳ Ma caisse', tabs: false },
  { id: 'onboarding', label: '↳ Onboarding / recrutement', tabs: false },
  { id: 'settings', label: '↳ Paramètres', tabs: false },
  { id: 'help', label: '↳ Aide / FAQ', tabs: false },
];

function MobileApp() {
  const [appearance, setAppearance] = useState('light');
  const [lang, setLang] = useState('fr');
  const [screen, setScreen] = useState('missions');
  const [tab, setTab] = useState('missions');
  const [proofLevel, setProofLevel] = useState('photo_signature');
  const go = (id) => {
    setScreen(id);
    const s = SCREEN_LIST.find((x) => x.id === id);
    if (s && s.tab) setTab(s.tab);
  };
  const meta = SCREEN_LIST.find((s) => s.id === screen) || SCREEN_LIST[1];

  const render = () => {
    switch (screen) {
      case 'login': return <Login go={go} />;
      case 'missions': return <Missions go={go} lang={lang} />;
      case 'route': return <RouteScreen go={go} appearance={appearance} />;
      case 'notifs': return <Notifications go={go} />;
      case 'scan': return <ScannerScreen go={go} />;
      case 'detail': return <MissionDetail go={go} appearance={appearance} />;
      case 'status': return <StatusUpdate go={go} />;
      case 'proof': return <Proof go={go} proofLevel={proofLevel} setProofLevel={setProofLevel} />;
      case 'cod': return <Cod go={go} />;
      case 'fail': return <Fail go={go} />;
      case 'shift': return <Shift go={go} />;
      case 'offline': return <Offline go={go} />;
      case 'done': return <Done go={go} />;
      case 'profil': return <Profil go={go} />;
      case 'earnings': return <Earnings go={go} />;
      case 'incident': return <Incident go={go} />;
      case 'objectives': return <Objectives go={go} />;
      case 'recap': return <DayRecap go={go} />;
      case 'support': return <Support go={go} />;
      case 'docs': return <Documents go={go} />;
      case 'macaisse': return <MaCaisse go={go} />;
      case 'onboarding': return <Onboarding go={go} />;
      case 'settings': return <Settings go={go} />;
      case 'help': return <Help go={go} />;
      default: return <Missions go={go} lang={lang} />;
    }
  };

  return (
    <Theme {...THEME} appearance={appearance} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh' }}>
      <Flex align="start" gap="6" p="6" style={{ minHeight: '100vh', background: 'var(--gray-2)' }} wrap="wrap">
        {/* Rail de navigation des écrans */}
        <Box style={{ width: 280, flex: '0 0 280px', position: 'sticky', top: 24 }}>
          <Flex align="center" gap="2" mb="4">
            <Flex align="center" justify="center" style={{ width: 34, height: 34, borderRadius: 'var(--radius-3)', background: 'var(--indigo-9)', color: 'white' }}><MobileIcon width="18" /></Flex>
            <Box><Heading size="4">App livreur</Heading><Text size="1" color="gray">React Native · maquette Radix</Text></Box>
          </Flex>
          <Flex direction="column" gap="1" mb="4">
            {SCREEN_LIST.map((s) => (
              <Button key={s.id} variant={screen === s.id ? 'soft' : 'ghost'} color={screen === s.id ? 'indigo' : 'gray'} onClick={() => go(s.id)} style={{ justifyContent: 'flex-start', height: 38 }}>
                <Text size="2">{s.label}</Text>
              </Button>
            ))}
          </Flex>
          <Separator size="4" mb="3" />
          <Flex align="center" justify="between">
            <Text size="2" color="gray">Apparence</Text>
            <SegmentedControl.Root size="1" value={appearance} onValueChange={setAppearance}>
              <SegmentedControl.Item value="light"><SunIcon /></SegmentedControl.Item>
              <SegmentedControl.Item value="dark"><MoonIcon /></SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          <Flex align="center" justify="between" mt="2">
            <Text size="2" color="gray">Langue</Text>
            <SegmentedControl.Root size="1" value={lang} onValueChange={setLang}>
              <SegmentedControl.Item value="fr">FR</SegmentedControl.Item>
              <SegmentedControl.Item value="ar">AR</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
          <Callout.Root color="gray" variant="surface" size="1" mt="3">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>Cadre 390×844. Cibles ≥ 48px, action principale en bas, onglets de navigation. Aucun composant React Native.</Callout.Text>
          </Callout.Root>
        </Box>

        {/* Téléphone */}
        <Box style={{ width: PHONE_W, height: PHONE_H, borderRadius: 46, padding: 10, background: 'var(--gray-12)', boxShadow: 'var(--shadow-5)', flex: '0 0 auto' }}>
          <Box style={{ width: '100%', height: '100%', borderRadius: 38, overflow: 'hidden', position: 'relative', background: 'var(--color-background)' }}>
            <PhoneShell tab={tab} lang={lang} setTab={(id) => { setTab(id); if (id === 'missions') go('missions'); if (id === 'route') go('route'); if (id === 'scan') go('scan'); if (id === 'shift') go('shift'); if (id === 'profil') go('profil'); }} showTabs={meta.tabs} dark={appearance === 'dark'}>
              {render()}
            </PhoneShell>
            <ToastHost />
          </Box>
        </Box>
      </Flex>
    </Theme>
  );
}

export function mountMobile(el) {
  createRoot(el).render(<MobileApp />);
}
