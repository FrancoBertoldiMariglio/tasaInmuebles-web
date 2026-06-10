import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agregarMiembro, actualizarRoles, quitarMiembro } from './actions';
import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva } from '@/lib/entidad-activa';
import { revalidatePath } from 'next/cache';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/entidad-activa', () => ({ getMembresiaActiva: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockGetMembresiaActiva = vi.mocked(getMembresiaActiva);
const mockRevalidatePath = vi.mocked(revalidatePath);

const USER = { id: 'user-1' };
const MEMBRESIA = {
  roles: ['admin'],
  entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
} as never;

/**
 * Mock unificado del client de Supabase: expone `auth.getUser` (gating temprano)
 * y `rpc` (la RPC SECURITY DEFINER de cada action). `rpc` resuelve a `{ error }`.
 */
function mockClient(user: unknown, rpcResult: { error: unknown } = { error: null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      rpc,
    },
    rpc,
  };
}

/** Helper: arma un FormData con pares clave→valor; arrays => append múltiple. */
function form(entries: Record<string, string | string[] | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((item) => fd.append(k, item));
    else fd.set(k, v);
  }
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(mockClient(USER).client as never);
  mockGetMembresiaActiva.mockResolvedValue(MEMBRESIA);
});

// ─── Gating compartido (requireAdminEntidad) ──────────────────────────────────
// Lo ejercemos vía agregarMiembro; las otras 2 actions usan el mismo gate.
describe('gating requireAdminEntidad (vía agregarMiembro)', () => {
  it('sin sesión → error de sesión expirada, sin tocar membresía ni RPC', async () => {
    const { client, rpc } = mockClient(null);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await agregarMiembro({}, form({ email: 'a@b.com', roles: 'admin' }));

    expect(res.error).toMatch(/Sesión expirada/);
    expect(mockGetMembresiaActiva).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sin membresía → error de organización', async () => {
    mockGetMembresiaActiva.mockResolvedValue(null);

    const res = await agregarMiembro({}, form({ email: 'a@b.com', roles: 'admin' }));

    expect(res.error).toMatch(/no está vinculada a ninguna organización/);
  });

  it('miembro sin rol admin → error de permiso', async () => {
    mockGetMembresiaActiva.mockResolvedValue({
      roles: ['tasador'],
      entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
    } as never);

    const res = await agregarMiembro({}, form({ email: 'a@b.com', roles: 'admin' }));

    expect(res.error).toMatch(/Solo el administrador/);
  });
});

// ─── agregarMiembro ───────────────────────────────────────────────────────────
describe('agregarMiembro', () => {
  it('email inválido → error sin llamar al backend', async () => {
    const { client, rpc } = mockClient(USER);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await agregarMiembro({}, form({ email: 'no-es-mail', roles: 'admin' }));

    expect(res.error).toBe('Ingresá un email válido.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('email ausente → error sin llamar al backend', async () => {
    const { client, rpc } = mockClient(USER);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await agregarMiembro({}, form({ roles: 'admin' }));

    expect(res.error).toBe('Ingresá un email válido.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sin roles válidos → error sin llamar al backend', async () => {
    const { client, rpc } = mockClient(USER);
    mockCreateClient.mockResolvedValue(client as never);

    // 'fantasma' no está en ROLES_VALIDOS → parseRoles lo filtra → roles vacío.
    const res = await agregarMiembro({}, form({ email: 'a@b.com', roles: 'fantasma' }));

    expect(res.error).toBe('Asigná al menos un rol.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('happy path → RPC con args correctos + revalidate + ok', async () => {
    const { client, rpc } = mockClient(USER, { error: null });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await agregarMiembro(
      {},
      form({ email: '  Persona@Empresa.com ', roles: ['admin', 'tasador'] }),
    );

    expect(rpc).toHaveBeenCalledWith('agregar_miembro_por_email', {
      _entidad: 'ent-1',
      _email: 'Persona@Empresa.com',
      _roles: ['admin', 'tasador'],
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/miembros');
    expect(res.ok).toContain('Persona@Empresa.com');
    expect(res.error).toBeUndefined();
  });

  it('error del backend → mensaje traducido (no se revalida)', async () => {
    const { client } = mockClient(USER, {
      error: { code: '42501', message: 'permission denied for table' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await agregarMiembro({}, form({ email: 'a@b.com', roles: 'admin' }));

    // traducirError mapea 42501 → mensaje de permiso (no expone el raw SQL).
    expect(res.error).toMatch(/No tenés permiso/);
    expect(res.error).not.toContain('permission denied for table');
    expect(res.ok).toBeUndefined();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

// ─── actualizarRoles ──────────────────────────────────────────────────────────
describe('actualizarRoles', () => {
  it('userId ausente → error sin llamar al backend', async () => {
    const { client, rpc } = mockClient(USER);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await actualizarRoles({}, form({ roles: 'admin' }));

    expect(res.error).toBe('Miembro inválido.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sin roles válidos → error sin llamar al backend', async () => {
    const { client, rpc } = mockClient(USER);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await actualizarRoles({}, form({ userId: 'u-9' }));

    expect(res.error).toBe('Asigná al menos un rol.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('happy path → RPC con args correctos + revalidate + ok', async () => {
    const { client, rpc } = mockClient(USER, { error: null });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await actualizarRoles(
      {},
      form({ userId: 'u-9', roles: ['solicitante'] }),
    );

    expect(rpc).toHaveBeenCalledWith('actualizar_roles_miembro', {
      _entidad: 'ent-1',
      _user: 'u-9',
      _roles: ['solicitante'],
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/miembros');
    expect(res.ok).toBe('Roles actualizados.');
  });

  it('error del backend → mensaje traducido', async () => {
    const { client } = mockClient(USER, {
      error: { code: 'P0002', message: 'El miembro no pertenece a la entidad.' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await actualizarRoles({}, form({ userId: 'u-9', roles: 'admin' }));

    // P0002 con mensaje legible: traducirError preserva el texto de negocio.
    expect(res.error).toBe('El miembro no pertenece a la entidad.');
    expect(res.ok).toBeUndefined();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('gating: sin sesión propaga error del gate', async () => {
    const { client } = mockClient(null);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await actualizarRoles({}, form({ userId: 'u-9', roles: 'admin' }));

    expect(res.error).toMatch(/Sesión expirada/);
  });
});

// ─── quitarMiembro ────────────────────────────────────────────────────────────
describe('quitarMiembro', () => {
  it('userId ausente → error sin llamar al backend', async () => {
    const { client, rpc } = mockClient(USER);
    mockCreateClient.mockResolvedValue(client as never);

    const res = await quitarMiembro({}, form({}));

    expect(res.error).toBe('Miembro inválido.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('happy path → RPC con args correctos + revalidate + ok', async () => {
    const { client, rpc } = mockClient(USER, { error: null });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await quitarMiembro({}, form({ userId: 'u-9' }));

    expect(rpc).toHaveBeenCalledWith('quitar_miembro_entidad', {
      _entidad: 'ent-1',
      _user: 'u-9',
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/miembros');
    expect(res.ok).toBe('Miembro dado de baja.');
  });

  it('error del backend → mensaje traducido (fallback genérico)', async () => {
    const { client } = mockClient(USER, {
      error: { code: 'XX999', message: 'internal boom' },
    });
    mockCreateClient.mockResolvedValue(client as never);

    const res = await quitarMiembro({}, form({ userId: 'u-9' }));

    // Código desconocido → fallback genérico, sin filtrar internals.
    expect(res.error).toMatch(/Ocurrió un error inesperado/);
    expect(res.error).not.toContain('internal boom');
    expect(res.ok).toBeUndefined();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('gating: miembro sin rol admin → error de permiso', async () => {
    mockGetMembresiaActiva.mockResolvedValue({
      roles: ['solicitante'],
      entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
    } as never);

    const res = await quitarMiembro({}, form({ userId: 'u-9' }));

    expect(res.error).toMatch(/Solo el administrador/);
  });
});
