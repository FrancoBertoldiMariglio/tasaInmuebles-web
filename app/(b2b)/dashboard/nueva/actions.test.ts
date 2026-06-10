import { describe, it, expect, vi, beforeEach } from 'vitest';
import { crearTasacion, cambiarEntidadActiva } from './actions';
import { createClient } from '@/lib/supabase/server';
import { getMembresiaActiva, setEntidadActiva } from '@/lib/entidad-activa';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/entidad-activa', () => ({
  getMembresiaActiva: vi.fn(),
  setEntidadActiva: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  // Next implementa redirect lanzando; replicamos ese contrato.
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);
const mockGetMembresiaActiva = vi.mocked(getMembresiaActiva);
const mockSetEntidadActiva = vi.mocked(setEntidadActiva);
const mockRedirect = vi.mocked(redirect);
const mockRevalidatePath = vi.mocked(revalidatePath);

const USER = { id: 'user-1' };
const MEMBRESIA = {
  roles: ['admin'],
  entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
} as never;

/** FormData válida; cada campo overrideable o suprimible con null. */
function form(overrides: Record<string, string | null> = {}): FormData {
  const base: Record<string, string> = {
    tipo: 'casa',
    motivo: 'venta',
    domicilio: 'Av. San Martín 1234',
    notas: 'Casa con patio',
  };
  const fd = new FormData();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== null) fd.set(k, v);
  }
  return fd;
}

/** Client de sesión con un user dado (o null). */
function mockSessionClient(user: unknown) {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  };
}

/**
 * Mock chainable de Supabase para el insert:
 * .from().insert().select().single() resuelve { data, error }.
 */
function mockInsertClient(user: unknown, result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return {
    client: {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from,
    },
    from,
    insert,
    select,
    single,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMembresiaActiva.mockResolvedValue(MEMBRESIA);
});

describe('crearTasacion', () => {
  it('sin sesión → error de sesión expirada, sin tocar membresía', async () => {
    mockCreateClient.mockResolvedValue(mockSessionClient(null) as never);

    const res = await crearTasacion({}, form());

    expect(res.error).toMatch(/Sesión expirada/);
    expect(mockGetMembresiaActiva).not.toHaveBeenCalled();
  });

  it('sin membresía activa → error de organización', async () => {
    mockCreateClient.mockResolvedValue(mockSessionClient(USER) as never);
    mockGetMembresiaActiva.mockResolvedValue(null);

    const res = await crearTasacion({}, form());

    expect(res.error).toMatch(/no está vinculada a ninguna organización/);
  });

  it('rol sin permiso (tasador) → error de permiso, sin insert', async () => {
    const m = mockInsertClient(USER, { data: null, error: null });
    mockCreateClient.mockResolvedValue(m.client as never);
    mockGetMembresiaActiva.mockResolvedValue({
      roles: ['tasador'],
      entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
    } as never);

    const res = await crearTasacion({}, form());

    expect(res.error).toMatch(/No tenés permisos/);
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('rol solicitante → puede crear (happy path)', async () => {
    const m = mockInsertClient(USER, {
      data: { id: 't-1', numero: 7 },
      error: null,
    });
    mockCreateClient.mockResolvedValue(m.client as never);
    mockGetMembresiaActiva.mockResolvedValue({
      roles: ['solicitante'],
      entidad: { id: 'ent-1', nombre: 'Banco Cuyo' },
    } as never);

    await expect(crearTasacion({}, form())).rejects.toThrow('NEXT_REDIRECT:/dashboard/tasaciones?creada=7');
    expect(m.insert).toHaveBeenCalled();
  });

  it('tipo inválido → error, sin insert', async () => {
    const m = mockInsertClient(USER, { data: null, error: null });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await crearTasacion({}, form({ tipo: 'castillo' }));

    expect(res.error).toBe('Tipo de inmueble inválido.');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('motivo inválido → error, sin insert', async () => {
    const m = mockInsertClient(USER, { data: null, error: null });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await crearTasacion({}, form({ motivo: 'capricho' }));

    expect(res.error).toBe('Motivo de tasación inválido.');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('domicilio ausente → error de dirección', async () => {
    const m = mockInsertClient(USER, { data: null, error: null });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await crearTasacion({}, form({ domicilio: null }));

    expect(res.error).toBe('Ingresá una dirección válida.');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('domicilio demasiado corto (<5) → error de dirección', async () => {
    const m = mockInsertClient(USER, { data: null, error: null });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await crearTasacion({}, form({ domicilio: '  AB  ' }));

    expect(res.error).toBe('Ingresá una dirección válida.');
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('happy path admin → insert con payload correcto, revalida y redirige', async () => {
    const m = mockInsertClient(USER, {
      data: { id: 't-9', numero: 42 },
      error: null,
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    await expect(crearTasacion({}, form())).rejects.toThrow('NEXT_REDIRECT:/dashboard/tasaciones?creada=42');

    expect(m.from).toHaveBeenCalledWith('tasaciones');
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        entidad_id: 'ent-1',
        creado_por: 'user-1',
        tipo: 'casa',
        motivo: 'venta',
        domicilio: 'Av. San Martín 1234',
        descripcion: 'Casa con patio',
        estado: 'pendiente',
        es_referencial: false,
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/tasaciones');
    expect(mockRedirect).toHaveBeenCalledWith('/dashboard/tasaciones?creada=42');
  });

  it('notas vacías → descripcion null en el payload', async () => {
    const m = mockInsertClient(USER, {
      data: { id: 't-3', numero: 3 },
      error: null,
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    await expect(crearTasacion({}, form({ notas: '   ' }))).rejects.toThrow('NEXT_REDIRECT');

    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ descripcion: null }),
    );
  });

  it('error del backend → mensaje con prefijo, sin redirigir', async () => {
    const m = mockInsertClient(USER, {
      data: null,
      error: { code: '23503', message: 'violates fk constraint "tasaciones_entidad_id_fkey"' },
    });
    mockCreateClient.mockResolvedValue(m.client as never);

    const res = await crearTasacion({}, form());

    // El mensaje crudo de Postgres NO debe filtrarse al usuario (review fix).
    expect(res.error).toMatch(/^Error al guardar: /);
    expect(res.error).not.toContain('fkey');
    expect(res.error).not.toContain('violates');
    expect(mockRevalidatePath).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});

describe('cambiarEntidadActiva', () => {
  it('setea la entidad y revalida el layout del dashboard', async () => {
    await cambiarEntidadActiva('ent-99');

    expect(mockSetEntidadActiva).toHaveBeenCalledWith('ent-99');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard', 'layout');
  });
});
