// AN-10 : le paywall doit couper les sessions en cours, pas seulement le login.
// Le TenantGuard lit désormais `status` et refuse tout tenant SUSPENDU, quel que
// soit le parcours (console transport, portail marchand, app livreur).
import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { TenantGuard } from './tenant.guard.ts';
import { pool } from '../db/pool.ts';

afterEach(() => mock.restoreAll());

function ctx(req: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function stubTenant(status: string | null) {
  mock.method(pool, 'query', async () => ({ rows: status === null ? [] : [{ slug: 'atlas', status }] }));
}

const guard = new TenantGuard();

test('tenant sain (ACTIF) : accès autorisé, schéma posé', async () => {
  stubTenant('ACTIF');
  const req: Record<string, unknown> = { user: { tenant: 'atlas' }, headers: {} };
  assert.equal(await guard.canActivate(ctx(req)), true);
  assert.equal(req.tenantSlug, 'atlas');
  assert.equal(req.tenantSchema, 'tenant_atlas');
});

test('tenant en essai (ESSAI) : accès autorisé', async () => {
  stubTenant('ESSAI');
  assert.equal(await guard.canActivate(ctx({ user: { tenant: 'atlas' }, headers: {} })), true);
});

test('tenant SUSPENDU + session déjà ouverte : 403 immédiat, message exact du login', async () => {
  stubTenant('SUSPENDU');
  await assert.rejects(
    guard.canActivate(ctx({ user: { tenant: 'atlas' }, headers: {} })),
    (e) => e instanceof ForbiddenException && e.message === 'Espace suspendu — contactez la plateforme.',
  );
});

test('tenant SUSPENDU via header (dev) : refusé aussi', async () => {
  stubTenant('SUSPENDU');
  await assert.rejects(
    guard.canActivate(ctx({ headers: { 'x-tenant-slug': 'atlas' } })),
    ForbiddenException,
  );
});

test('tenant inconnu : 400', async () => {
  stubTenant(null);
  await assert.rejects(
    guard.canActivate(ctx({ user: { tenant: 'atlas' }, headers: {} })),
    BadRequestException,
  );
});

test('incohérence JWT/header : 403, le JWT prime', async () => {
  await assert.rejects(
    guard.canActivate(ctx({ user: { tenant: 'atlas' }, headers: { 'x-tenant-slug': 'autre' } })),
    ForbiddenException,
  );
});
