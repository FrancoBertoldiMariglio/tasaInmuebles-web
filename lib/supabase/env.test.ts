import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  requireEnv,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey,
} from './env';

describe('requireEnv', () => {
  it('devuelve el valor cuando está definido', () => {
    expect(requireEnv('FOO', 'bar')).toBe('bar');
  });

  it('tira Error descriptivo cuando el valor es undefined', () => {
    expect(() => requireEnv('FOO', undefined)).toThrow(
      /Falta la variable de entorno FOO/,
    );
  });

  it('tira Error cuando el valor es string vacío', () => {
    expect(() => requireEnv('FOO', '')).toThrow(
      /Falta la variable de entorno FOO/,
    );
  });

  it('el mensaje menciona la causa probable en K8s (Secret mal montado)', () => {
    expect(() => requireEnv('FOO', undefined)).toThrow(/Secret mal montado/);
  });
});

describe('helpers específicos de Supabase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('supabaseUrl devuelve el valor cuando la env var existe', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proyecto.supabase.co');
    expect(supabaseUrl()).toBe('https://proyecto.supabase.co');
  });

  it('supabaseUrl tira Error cuando falta NEXT_PUBLIC_SUPABASE_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(() => supabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('supabaseAnonKey devuelve el valor cuando la env var existe', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
    expect(supabaseAnonKey()).toBe('anon-key-123');
  });

  it('supabaseAnonKey tira Error cuando falta NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
    expect(() => supabaseAnonKey()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it('supabaseServiceRoleKey devuelve el valor cuando la env var existe', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-456');
    expect(supabaseServiceRoleKey()).toBe('service-role-456');
  });

  it('supabaseServiceRoleKey tira Error cuando falta SUPABASE_SERVICE_ROLE_KEY', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => supabaseServiceRoleKey()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
