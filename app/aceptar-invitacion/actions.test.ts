import { describe, it, expect, vi, beforeEach } from 'vitest';
import { finalizarInvitacion } from './actions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

const USER = {
  id: 'user-1',
  user_metadata: { entidad_id: 'ent-1' },
};

/** Client de sesión: getUser devuelve `user` y updateUser resuelve a `pwResult`. */
function mockSessionClient(user: unknown, pwResult: { error: unknown } = { error: null }) {
  const updateUser = vi.fn().mockResolvedValue(pwResult);
  return {
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user } }),
        updateUser,
      },
    },
    updateUser,
  };
}

/** Admin client: upsert sobre entidad_miembros resuelve a `result`. */
function mockAdmin(result: { error: unknown } = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { from }, from, upsert };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('finalizarInvitacion', () => {
  it('password vacía → error de validación sin tocar el backend', async () => {
    const session = mockSessionClient(USER);
    mockCreateClient.mockResolvedValue(session.client as never);
    const admin = mockAdmin();
    mockCreateAdminClient.mockReturnValue(admin.client as never);

    const res = await finalizarInvitacion('');

    expect(res.error).toMatch(/al menos 8 caracteres/);
    expect(res.ok).toBeUndefined();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('password corta (<8) → error de validación', async () => {
    const res = await finalizarInvitacion('1234567');

    expect(res.error).toMatch(/al menos 8 caracteres/);
    expect(res.ok).toBeUndefined();
  });

  it('sin sesión (user null) → error de invitación inválida', async () => {
    const session = mockSessionClient(null);
    mockCreateClient.mockResolvedValue(session.client as never);

    const res = await finalizarInvitacion('passwordok');

    expect(res.error).toMatch(/Invitación inválida o expirada/);
    expect(res.ok).toBeUndefined();
  });

  it('user sin entidad_id en metadata → error de entidad asociada', async () => {
    const session = mockSessionClient({ id: 'user-1', user_metadata: {} });
    mockCreateClient.mockResolvedValue(session.client as never);

    const res = await finalizarInvitacion('passwordok');

    expect(res.error).toMatch(/no tiene una entidad asociada/);
    expect(res.ok).toBeUndefined();
  });

  it('happy path → vincula entidad, setea password y devuelve ok', async () => {
    const session = mockSessionClient(USER);
    mockCreateClient.mockResolvedValue(session.client as never);
    const admin = mockAdmin({ error: null });
    mockCreateAdminClient.mockReturnValue(admin.client as never);

    const res = await finalizarInvitacion('passwordok');

    expect(res.ok).toBe(true);
    expect(res.error).toBeUndefined();
    expect(admin.from).toHaveBeenCalledWith('entidad_miembros');
    expect(admin.upsert).toHaveBeenCalledWith(
      { entidad_id: 'ent-1', user_id: 'user-1', roles: ['solicitante'] },
      { onConflict: 'entidad_id,user_id' },
    );
    expect(session.updateUser).toHaveBeenCalledWith({ password: 'passwordok' });
  });

  it('error al vincular entidad → error y NO setea password', async () => {
    const session = mockSessionClient(USER);
    mockCreateClient.mockResolvedValue(session.client as never);
    const admin = mockAdmin({ error: { message: 'FK rota' } });
    mockCreateAdminClient.mockReturnValue(admin.client as never);

    const res = await finalizarInvitacion('passwordok');

    expect(res.error).toBe('No se pudo vincularte a la entidad: FK rota');
    expect(res.ok).toBeUndefined();
    expect(session.updateUser).not.toHaveBeenCalled();
  });

  it('error al setear password → error descriptivo', async () => {
    const session = mockSessionClient(USER, { error: { message: 'weak password' } });
    mockCreateClient.mockResolvedValue(session.client as never);
    const admin = mockAdmin({ error: null });
    mockCreateAdminClient.mockReturnValue(admin.client as never);

    const res = await finalizarInvitacion('passwordok');

    expect(res.error).toBe('No se pudo establecer la contraseña: weak password');
    expect(res.ok).toBeUndefined();
  });
});
