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
export interface Vehicle { id: string; plate: string; type: string; city: string | null; state: string; insuranceDue: string | null; ctDue: string | null; createdAt: string }
export interface Zone { id: string; nameFr: string; nameAr: string | null; color: string; commune: string | null; drivers: string[]; createdAt: string }
export interface ReturnRow { ref: string; reason: string; attempts: number; status: string; createdAt: string }
export interface NotificationRow { id: string; event: string; channel: string; recipient: string; lang: string; body: string; status: string; reason: string | null; createdAt: string }
export interface Invoice { merchant: string; deliveries: number; codCollected: number; commission: number; netHt: number; tva: number; ttc: number }
export interface Reconciliation { driver: string; theorique: number; deliveries: number }
export interface Payout { merchant: string; brut: number; orders: number; commissionRate: number; net: number }
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

  // --- Flotte & dispatch ---
  getDrivers(): Promise<Driver[]> { return this.req('/v1/drivers'); }
  getVehicles(): Promise<Vehicle[]> { return this.req('/v1/vehicles'); }
  getZones(): Promise<Zone[]> { return this.req('/v1/dispatch/zones'); }
  getFleetLive(): Promise<FleetLive[]> { return this.req('/v1/tracking/live'); }
  getFleetAlerts(): Promise<FleetLive[]> { return this.req('/v1/tracking/alerts'); }

  // --- Argent ---
  getReconciliation(): Promise<Reconciliation[]> { return this.req('/v1/cash/reconciliation'); }
  getPayouts(): Promise<Payout[]> { return this.req('/v1/cash/payouts'); }
  getInvoices(): Promise<Invoice[]> { return this.req('/v1/invoices'); }

  // --- Flux inverses & notifications ---
  getReturns(): Promise<ReturnRow[]> { return this.req('/v1/returns'); }
  getNotifications(): Promise<NotificationRow[]> { return this.req('/v1/notifications'); }

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
