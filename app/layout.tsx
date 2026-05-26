import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tasa Inmuebles',
  description: 'Plataforma de gestión de tasaciones inmobiliarias',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
