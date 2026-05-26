import type { Config } from 'tailwindcss';

/**
 * Tasainmuebles DS — Tailwind theme alineado con proyecto/wiki/design-system.md.
 * Source of truth: proyecto/codigo/tasainmuebles/design-system/tokens.json (W3C DTCG).
 * Capa semántica (brand/surface/text/border/status) — las screens NUNCA usan palette crudo.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F87171',
          primary: '#F87171',
          primaryDeep: '#EF4444',
          primaryDeeper: '#DC2626',
          primarySoft: '#FEE2E2',
          primaryBg: '#FFF7F5',
        },
        surface: {
          page: '#F4F5F8',
          pageAlt: '#EEF0F5',
          card: '#FFFFFF',
          navDark: '#2A3140',
        },
        ink: {
          primary: '#1F2937',
          secondary: '#374151',
          muted: '#9CA3AF',
          muted2: '#6B7280',
          onDark: '#FFFFFF',
        },
        line: {
          DEFAULT: '#E5E7EB',
          soft: '#EEF0F4',
          dashed: '#D1D5DB',
        },
        status: {
          success: '#10B981',
          successSoft: '#D1FAE5',
          warning: '#FBBF24',
          warningSoft: '#FEF3C7',
          warningText: '#92400E',
          info: '#60A5FA',
          infoSoft: '#DBEAFE',
          danger: '#EF4444',
          dangerSoft: '#FEE2E2',
        },
      },
      borderColor: { DEFAULT: '#E5E7EB' },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        '4xl': '40px',
        '5xl': '48px',
        '6xl': '64px',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '28px',
        '3xl': '36px',
      },
      fontSize: {
        'ds-xs': ['11px', '16px'],
        'ds-sm': ['12px', '16px'],
        'ds-base': ['13px', '18px'],
        'ds-md': ['14px', '20px'],
        'ds-lg': ['15px', '22px'],
        'ds-xl': ['17px', '24px'],
        'ds-2xl': ['20px', '28px'],
        'ds-3xl': ['24px', '32px'],
        'ds-4xl': ['28px', '36px'],
        'ds-5xl': ['32px', '40px'],
        'ds-6xl': ['40px', '48px'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
        cardHover:
          '0 4px 8px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.08)',
      },
      transitionDuration: { fast: '120ms', base: '200ms', slow: '320ms' },
    },
  },
  plugins: [],
} satisfies Config;
