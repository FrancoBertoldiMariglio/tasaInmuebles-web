import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invitarMiembro } from './actions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMembresiaActiva } from '@/lib/entidad-activa';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/entidad-activa', () => ({ getMembresiaActiva: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockGetMembresiaActiva = vi.mocked(getMembresiaActiva);

const USER = { id: 'user-1' };
const MEMBRESIA = {
  roles: ['admin'],
  entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
} as never;

function form(email: unknown): FormData {
  const fd = new FormData();
  if (email !== undefined) fd.set('email', email as string);
  return fd;
}

/** Mock del client de sesión con un user dado (o null). */
function mockSessionClient(user: unknown) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  };
}

/** Mock del admin client; inviteUserByEmail resuelve a { error }. */
function mockInvite(result: { error: unknown }) {
  const inviteUserByEmail = vi.fn().mockResolvedValue(result);
  return {
    client: { auth: { admin: { inviteUserByEmail } } },
    inviteUserByEmail,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateClient.mockResolvedValue(mockSessionClient(USER) as never);
  mockGetMembresiaActiva.mockResolvedValue(MEMBRESIA);
});

describe('invitarMiembro', () => {
  it('email inválido → error sin llamar al backend', async () => {
    const invite = mockInvite({ error: null });
    mockCreateAdminClient.mockReturnValue(invite.client as never);

    const res = await invitarMiembro({}, form('no-es-un-email'));

    expect(res.error).toBe('Ingresá un email válido.');
    expect(res.ok).toBeUndefined();
    // Clave: nunca se tocó la Admin API.
    expect(invite.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('email ausente → error sin llamar al backend', async () => {
    const invite = mockInvite({ error: null });
    mockCreateAdminClient.mockReturnValue(invite.client as never);

    const res = await invitarMiembro({}, form(undefined));

    expect(res.error).toBe('Ingresá un email válido.');
    expect(invite.inviteUserByEmail).not.toHaveBeenCalled();
  });

  it('email válido happy path → ok + email normalizado', async () => {
    const invite = mockInvite({ error: null });
    mockCreateAdminClient.mockReturnValue(invite.client as never);

    const res = await invitarMiembro({}, form('  Persona@Empresa.COM '));

    expect(res.ok).toBe(true);
    expect(res.email).toBe('persona@empresa.com');
    expect(invite.inviteUserByEmail).toHaveBeenCalledWith(
      'persona@empresa.com',
      expect.objectContaining({
        data: expect.objectContaining({ entidad_id: 'ent-1' }),
      }),
    );
  });

  it('backend 422 → mensaje descriptivo de duplicado', async () => {
    const invite = mockInvite({
      error: { status: 422, message: 'User already registered' },
    });
    mockCreateAdminClient.mockReturnValue(invite.client as never);

    const res = await invitarMiembro({}, form('repetido@empresa.com'));

    expect(res.error).toBe('Ese email ya tiene una invitación o cuenta.');
    expect(res.ok).toBeUndefined();
  });

  it('backend con error genérico → mensaje traducido con prefijo', async () => {
    const invite = mockInvite({
      error: { status: 500, message: 'boom interno' },
    });
    mockCreateAdminClient.mockReturnValue(invite.client as never);

    const res = await invitarMiembro({}, form('alguien@empresa.com'));

    expect(res.error).toMatch(/^No se pudo enviar la invitación: /);
    expect(res.ok).toBeUndefined();
  });

  it('sin sesión → error de sesión expirada, sin llamar a membresía', async () => {
    mockCreateClient.mockResolvedValue(mockSessionClient(null) as never);

    const res = await invitarMiembro({}, form('alguien@empresa.com'));

    expect(res.error).toMatch(/Sesión expirada/);
    expect(mockGetMembresiaActiva).not.toHaveBeenCalled();
  });

  it('sin membresía → error de organización', async () => {
    mockGetMembresiaActiva.mockResolvedValue(null);

    const res = await invitarMiembro({}, form('alguien@empresa.com'));

    expect(res.error).toMatch(/no está vinculada a ninguna organización/);
  });

  it('miembro sin rol admin → error de permiso', async () => {
    mockGetMembresiaActiva.mockResolvedValue({
      roles: ['tasador'],
      entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
    } as never);

    const res = await invitarMiembro({}, form('alguien@empresa.com'));

    expect(res.error).toMatch(/Solo un administrador/);
  });
});
