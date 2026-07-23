// @transpo/api-client — client HTTP typé, partagé par les fronts (Next.js + Expo).
// S'appuie sur les types de @transpo/domain. Gère token JWT + tenant. Cf. skill transpo-api.
import type { Order, Role } from '@transpo/domain';

export interface ClientOptions {
  baseUrl: string;
  token?: string;
  tenant?: string; // slug (dev via header ; en prod le tenant vient du JWT)
}

export interface LoginResult { token: string; role: Role; name: string }
export interface SuperLoginResult { token: string; name: string }
export interface Tenant {
  slug: string; name: string; city: string | null; plan: string; status: string; createdAt: string;
}
export interface AnalyticsSummary {
  total: number; byStatus: Record<string, number>;
  delivered: number; failed: number; successRate: number; codCollected: number;
}
export interface FraudCase {
  id: string; driver: string; amount: number; signals: string[];
  score: number; status: string; summary: string | null; createdAt: string;
}
export interface RiskDriver { driver: string; cases: number; risk: number }
export interface Tournee {
  id: string; driver: string; zone: string | null; day: string; status: string;
  stops: string[]; createdAt: string;
}
export interface Driver { id: string; name: string; city: string | null; vehicle: string | null; available: boolean; createdAt: string }
export interface Vehicle {
  id: string; plate: string; type: string; city: string | null; state: string;
  insuranceDue: string | null; ctDue: string | null; capacity: string | null; equipment: string[];
  insuranceExpired: boolean; ctExpired: boolean; assignable: boolean; createdAt: string;
}
export interface Zone { id: string; nameFr: string; nameAr: string | null; color: string; commune: string | null; region: string | null; province: string | null; drivers: string[]; centerLat: number | null; centerLng: number | null; polygon: number[][] | null; createdAt: string }
export interface Suggestion { driver: string; city: string; vehicle: string; score: number; parts: { zone: number; dispo: number; charge: number } }
export interface ReturnRow { ref: string; reason: string; attempts: number; status: string; createdAt: string }
export interface NotificationRow { id: string; event: string; channel: string; recipient: string; lang: string; body: string; status: string; reason: string | null; createdAt: string }
export type ConsoleRole = 'ADMIN' | 'DISPATCHER' | 'COMPTABLE';
export interface ConsoleUser { id: string; email: string; name: string; role: ConsoleRole; active: boolean; createdAt: string }
export interface InviteUserResult extends ConsoleUser { tempPassword: string }
export interface ResetPasswordResult { id: string; tempPassword: string }
export type InvoiceStatus = 'BROUILLON' | 'ENVOYEE' | 'PAYEE' | 'LITIGE';
export interface Invoice {
  id: string; ref: string; merchant: string; period: string; orders: number;
  deliveries: number; codCollected: number; commission: number; netHt: number; tva: number; ttc: number;
  status: InvoiceStatus; color: string; disputeAmount: number | null; disputeNote: string | null;
}
export interface BillingMode { merchant: string; mode: 'prepaid' | 'postpaid' }
export interface QuoteResult { applied: 'grille' | 'remise' | 'fixe_marchand'; base: number; surcharges: number; ht: number; tva: number; ttc: number }
export interface PriceTier { from: number; to: number | null; base?: number; perKm?: number }
export interface PriceConfig { tiers: PriceTier[]; fragileSurcharge: number; scheduledSurcharge: number; discountRate: number }
export interface Reconciliation { driver: string; theorique: number; deliveries: number }
export interface CashMove { ref: string; recipient: string; amount: number; matched: boolean }
export interface CashSession {
  id: string; driver: string; ini: string; date: string;
  theorique: number; declared: number | null; deposited: number; deliveries: number;
  cap: number; status: 'EN_COURS' | 'A_DEPOSER' | 'ECART' | 'DEPOSE';
  reason: string | null; note: string | null; ecart: number | null; moves: CashMove[];
}
export interface Payout { merchant: string; brut: number; orders: number; commissionRate: number; net: number }
export type ReversementStatus = 'EN_ATTENTE' | 'VERSE';
export interface Reversement {
  id: string; merchant: string; period: string; orders: number; cod: number;
  status: ReversementStatus; method: string | null; reference: string | null; paidAt: string | null;
}
export interface FleetLive { driver: string; lat: number; lng: number; at: string; zone: string | null; distanceM: number | null; outOfZone: boolean }
export interface TrackStep { status: string; label: string; done: boolean }
export interface TrackResult {
  code: string; status: string; statusLabel: string; color: string;
  from: string; to: string; steps: TrackStep[];
  delivered: boolean; canRate: boolean; rating: number | null; terminal: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export class TranspoClient {
  constructor(private opts: ClientOptions) {}

  withToken(token: string): TranspoClient {
    return new TranspoClient({ ...this.opts, token });
  }
  withTenant(tenant: string): TranspoClient {
    return new TranspoClient({ ...this.opts, tenant });
  }

  private async req<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
    const headers: Record<string, string> = { ...(init.headers ?? {}) };
    if (this.opts.token) headers['authorization'] = `Bearer ${this.opts.token}`;
    if (this.opts.tenant) headers['x-tenant-slug'] = this.opts.tenant;
    if (init.body) headers['content-type'] = 'application/json';
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(res.status, (json && (json.message as string)) || res.statusText);
    }
    return json as T;
  }

  // --- Auth ---
  login(email: string, password: string): Promise<LoginResult> {
    return this.req('/v1/auth/login', { method: 'POST', body: { email, password } });
  }
  superLogin(email: string, password: string): Promise<SuperLoginResult> {
    return this.req('/v1/auth/super/login', { method: 'POST', body: { email, password } });
  }

  // --- Commandes ---
  getOrders(): Promise<Order[]> {
    return this.req('/v1/orders');
  }
  getOrder(ref: string): Promise<Order> {
    return this.req(`/v1/orders/${encodeURIComponent(ref)}`);
  }
  createOrder(input: {
    merchant?: string; fromCity: string; toCity: string;
    cod?: number; size?: string; scheduled?: boolean;
  }): Promise<Order> {
    return this.req('/v1/orders', { method: 'POST', body: input });
  }

  // --- Analytics ---
  getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.req('/v1/analytics/summary');
  }

  // --- Fraude ---
  getFraudCases(): Promise<FraudCase[]> {
    return this.req('/v1/fraud/cases');
  }
  getFraudLeaderboard(): Promise<RiskDriver[]> {
    return this.req('/v1/fraud/leaderboard');
  }

  // --- Tournées ---
  getTournees(): Promise<Tournee[]> {
    return this.req('/v1/tournees');
  }
  getTournee(id: string): Promise<Tournee & { orders: Order[] }> {
    return this.req(`/v1/tournees/${encodeURIComponent(id)}`);
  }

  // --- Flotte & dispatch ---
  getDrivers(): Promise<Driver[]> { return this.req('/v1/drivers'); }
  getVehicles(): Promise<Vehicle[]> { return this.req('/v1/vehicles'); }
  createVehicle(input: Partial<Vehicle> & { plate: string; type: string }): Promise<Vehicle> {
    return this.req('/v1/vehicles', { method: 'POST', body: input });
  }
  setVehicleState(id: string, state: string): Promise<Vehicle> {
    return this.req(`/v1/vehicles/${encodeURIComponent(id)}/state`, { method: 'PATCH', body: { state } });
  }
  renewVehicle(id: string, field: 'insurance' | 'ct', due: string): Promise<Vehicle> {
    return this.req(`/v1/vehicles/${encodeURIComponent(id)}/renew`, { method: 'POST', body: { field, due } });
  }
  deleteVehicle(id: string): Promise<{ ok: boolean }> {
    return this.req(`/v1/vehicles/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
  getZones(): Promise<Zone[]> { return this.req('/v1/dispatch/zones'); }
  suggestDrivers(ref: string): Promise<{ order: string; suggestions: Suggestion[] }> {
    return this.req(`/v1/dispatch/suggest/${encodeURIComponent(ref)}`);
  }
  getFleetLive(): Promise<FleetLive[]> { return this.req('/v1/tracking/live'); }
  getFleetAlerts(): Promise<FleetLive[]> { return this.req('/v1/tracking/alerts'); }

  // --- Argent ---
  getCashSessions(): Promise<CashSession[]> { return this.req('/v1/cash/sessions'); }
  depositCashSession(id: string): Promise<{ id: string; status: string; deposited: number }> {
    return this.req(`/v1/cash/sessions/${encodeURIComponent(id)}/deposit`, { method: 'POST' });
  }
  resolveCashSession(id: string, reason: string, note?: string): Promise<{ id: string; status: string; reason: string }> {
    return this.req(`/v1/cash/sessions/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: { reason, note } });
  }
  getPricingConfig(): Promise<PriceConfig> { return this.req('/v1/pricing/config'); }
  savePricingConfig(cfg: PriceConfig): Promise<{ ok: boolean }> {
    return this.req('/v1/pricing/config', { method: 'POST', body: cfg });
  }
  getReconciliation(): Promise<Reconciliation[]> { return this.req('/v1/cash/reconciliation'); }
  getPayouts(): Promise<Payout[]> { return this.req('/v1/cash/payouts'); }
  getReversements(): Promise<Reversement[]> { return this.req('/v1/cash/reversements'); }
  generateReversements(period?: string): Promise<{ created: number; merchants: string[] }> {
    return this.req('/v1/cash/reversements/generate', { method: 'POST', body: { period } });
  }
  payReversement(id: string, method: string, reference?: string): Promise<{ id: string; status: string; method: string; reference: string }> {
    return this.req(`/v1/cash/reversements/${encodeURIComponent(id)}/pay`, { method: 'POST', body: { method, reference } });
  }
  getInvoices(): Promise<Invoice[]> { return this.req('/v1/invoices'); }
  getBillingModes(): Promise<BillingMode[]> { return this.req('/v1/invoices/billing-modes'); }
  setBillingMode(merchant: string, mode: string): Promise<BillingMode> {
    return this.req('/v1/invoices/billing-modes', { method: 'POST', body: { merchant, mode } });
  }
  generateInvoices(period?: string): Promise<{ created: number; refs: string[] }> {
    return this.req('/v1/invoices/generate', { method: 'POST', body: { period } });
  }
  sendInvoice(id: string): Promise<{ id: string; ref: string; status: string }> {
    return this.req(`/v1/invoices/${encodeURIComponent(id)}/send`, { method: 'POST' });
  }
  payInvoice(id: string): Promise<{ id: string; ref: string; status: string }> {
    return this.req(`/v1/invoices/${encodeURIComponent(id)}/pay`, { method: 'POST' });
  }
  disputeInvoice(id: string, amount: number, note?: string): Promise<{ id: string; ref: string; status: string }> {
    return this.req(`/v1/invoices/${encodeURIComponent(id)}/dispute`, { method: 'POST', body: { amount, note } });
  }
  resolveInvoiceDispute(id: string, decision: string): Promise<{ id: string; ref: string; status: string }> {
    return this.req(`/v1/invoices/${encodeURIComponent(id)}/resolve`, { method: 'POST', body: { decision } });
  }

  // --- Flux inverses & notifications ---
  getReturns(): Promise<ReturnRow[]> { return this.req('/v1/returns'); }
  getHub(): Promise<Order[]> { return this.req('/v1/hub'); }
  getNotifications(): Promise<NotificationRow[]> { return this.req('/v1/notifications'); }

  // --- Utilisateurs & rôles ---
  getUsers(): Promise<ConsoleUser[]> { return this.req('/v1/users'); }
  inviteUser(input: { email: string; name: string; role: ConsoleRole }): Promise<InviteUserResult> {
    return this.req('/v1/users', { method: 'POST', body: input });
  }
  setUserRole(id: string, role: ConsoleRole): Promise<ConsoleUser> {
    return this.req(`/v1/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', body: { role } });
  }
  setUserActive(id: string, active: boolean): Promise<ConsoleUser> {
    return this.req(`/v1/users/${encodeURIComponent(id)}/active`, { method: 'PATCH', body: { active } });
  }
  resetUserPassword(id: string): Promise<ResetPasswordResult> {
    return this.req(`/v1/users/${encodeURIComponent(id)}/reset-password`, { method: 'POST' });
  }

  // --- Suivi public client (sans authentification ; tenant dans l'URL) ---
  publicTrack(slug: string, code: string): Promise<TrackResult> {
    return this.req(`/v1/public/track/${encodeURIComponent(slug)}/${encodeURIComponent(code)}`);
  }
  publicRate(slug: string, code: string, score: number, comment?: string): Promise<{ code: string; rating: number }> {
    return this.req(`/v1/public/track/${encodeURIComponent(slug)}/${encodeURIComponent(code)}/rate`, {
      method: 'POST', body: { score, comment },
    });
  }

  // --- App livreur (rôle DRIVER) ---
  getMissions(): Promise<Order[]> { return this.req('/v1/driver/missions'); }
  driverAdvance(ref: string, idemKey: string): Promise<Order> {
    return this.req(`/v1/driver/orders/${encodeURIComponent(ref)}/advance`, {
      method: 'POST', body: {}, headers: { 'idempotency-key': idemKey },
    });
  }
  driverProof(ref: string, body: { codCollected?: number }, idemKey: string): Promise<Order> {
    return this.req(`/v1/driver/orders/${encodeURIComponent(ref)}/proof`, {
      method: 'POST', body, headers: { 'idempotency-key': idemKey },
    });
  }

  // --- SaaS ---
  listTenants(): Promise<Tenant[]> {
    return this.req('/v1/saas/tenants');
  }
  provisionTenant(input: { slug: string; name: string; city?: string; plan?: string }): Promise<{ slug: string; provisioned: boolean }> {
    return this.req('/v1/saas/tenants', { method: 'POST', body: input });
  }
}

export function createClient(opts: ClientOptions): TranspoClient {
  return new TranspoClient(opts);
}
