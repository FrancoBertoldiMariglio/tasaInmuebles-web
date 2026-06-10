import { describe, it, expect, vi } from 'vitest';
import { listarTasadoresDeEntidad, TasadoresQueryError } from './queries';

/**
 * Mock del client de Supabase para `listarTasadoresDeEntidad`:
 *   - `rpc('listar_miembros_entidad')` → { data, error }
 *   - `from('tasador_especialidades').select(...).in(...)` → { data, error }
 *
 * `from(...).select(...).in(...)` es thenable: la cadena resuelve al resultado.
 */
function mockClient(opts: {
  miembros?: { data: unknown; error: unknown };
  especialidades?: { data: unknown; error: unknown };
}) {
  const rpc = vi
    .fn()
    .mockResolvedValue(opts.miembros ?? { data: [], error: null });

  const inMock = vi
    .fn()
    .mockResolvedValue(opts.especialidades ?? { data: [], error: null });
  const select = vi.fn().mockReturnValue({ in: inMock });
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { rpc, from } as never,
    rpc,
    from,
    select,
    inMock,
  };
}

const ENTIDAD = 'ent-1';

describe('listarTasadoresDeEntidad', () => {
  it('happy path: mapea tasadores con sus especialidades agrupadas y ordenadas', async () => {
    const { client, rpc, from, inMock } = mockClient({
      miembros: {
        data: [
          {
            user_id: 'u-zarate',
            email: 'zarate@x.com',
            nombre: 'Ana',
            apellido: 'Zárate',
            telefono: null,
            matricula: 'MAT-99',
            roles: ['tasador'],
            created_at: '2026-01-01',
          },
          {
            user_id: 'u-alvarez',
            email: 'alvarez@x.com',
            nombre: 'Beto',
            apellido: 'Álvarez',
            telefono: null,
            matricula: 'MAT-01',
            roles: ['tasador', 'admin'],
            created_at: '2026-01-02',
          },
          {
            user_id: 'u-solic',
            email: 'solic@x.com',
            nombre: 'Carla',
            apellido: 'Solo',
            telefono: null,
            matricula: null,
            roles: ['solicitante'],
            created_at: '2026-01-03',
          },
        ],
        error: null,
      },
      especialidades: {
        data: [
          { user_id: 'u-zarate', tipo: 'casa' },
          { user_id: 'u-zarate', tipo: 'depto' },
          { user_id: 'u-alvarez', tipo: 'terreno' },
        ],
        error: null,
      },
    });

    const res = await listarTasadoresDeEntidad(client, ENTIDAD);

    // El solicitante queda fuera; orden por apellido: Álvarez antes que Zárate.
    expect(res).toHaveLength(2);
    expect(res[0].userId).toBe('u-alvarez');
    expect(res[0].especialidades).toEqual(['terreno']);
    expect(res[1].userId).toBe('u-zarate');
    expect(res[1].especialidades).toEqual(['casa', 'depto']);
    expect(res[1].matricula).toBe('MAT-99');

    expect(rpc).toHaveBeenCalledWith('listar_miembros_entidad', {
      _entidad: ENTIDAD,
    });
    expect(from).toHaveBeenCalledWith('tasador_especialidades');
    expect(inMock).toHaveBeenCalledWith('user_id', ['u-zarate', 'u-alvarez']);
  });

  it('tasador sin especialidades → array vacío', async () => {
    const { client } = mockClient({
      miembros: {
        data: [
          {
            user_id: 'u-1',
            email: 'a@x.com',
            nombre: 'A',
            apellido: 'A',
            telefono: null,
            matricula: null,
            roles: ['tasador'],
            created_at: '2026-01-01',
          },
        ],
        error: null,
      },
      especialidades: { data: [], error: null },
    });

    const res = await listarTasadoresDeEntidad(client, ENTIDAD);
    expect(res).toHaveLength(1);
    expect(res[0].especialidades).toEqual([]);
  });

  it('sin tasadores → lista vacía y NO consulta especialidades', async () => {
    const { client, from } = mockClient({
      miembros: {
        data: [
          {
            user_id: 'u-1',
            email: 'a@x.com',
            nombre: 'A',
            apellido: 'A',
            telefono: null,
            matricula: null,
            roles: ['solicitante'],
            created_at: '2026-01-01',
          },
        ],
        error: null,
      },
    });

    const res = await listarTasadoresDeEntidad(client, ENTIDAD);
    expect(res).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('data null de la RPC → lista vacía', async () => {
    const { client } = mockClient({ miembros: { data: null, error: null } });
    const res = await listarTasadoresDeEntidad(client, ENTIDAD);
    expect(res).toEqual([]);
  });

  it('error en la RPC de miembros → TasadoresQueryError', async () => {
    const { client } = mockClient({
      miembros: { data: null, error: { message: 'No autorizado' } },
    });
    await expect(listarTasadoresDeEntidad(client, ENTIDAD)).rejects.toThrow(
      TasadoresQueryError,
    );
  });

  it('error al cargar especialidades → TasadoresQueryError', async () => {
    const { client } = mockClient({
      miembros: {
        data: [
          {
            user_id: 'u-1',
            email: 'a@x.com',
            nombre: 'A',
            apellido: 'A',
            telefono: null,
            matricula: null,
            roles: ['tasador'],
            created_at: '2026-01-01',
          },
        ],
        error: null,
      },
      especialidades: { data: null, error: { message: 'rls' } },
    });
    await expect(listarTasadoresDeEntidad(client, ENTIDAD)).rejects.toThrow(
      'No se pudieron cargar las especialidades',
    );
  });
});
