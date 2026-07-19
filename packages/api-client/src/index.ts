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

  private async req<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const headers: Record<string, string> = {};
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
