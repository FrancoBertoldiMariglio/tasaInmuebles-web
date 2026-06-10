import type { NextConfig } from 'next';
import path from 'node:path';

// TSK-148/WEB-04: derivamos el host de Supabase Storage de la URL pública del
// proyecto (`https://<project>.supabase.co`) para habilitar next/image sobre las
// signed URLs de fotos del bucket privado. Si la env no está seteada (build sin
// .env), no agregamos patrón: <Image> sobre ese host fallaría en runtime igual.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/sign/**',
          },
        ]
      : [],
  },
  // Genera un server autocontenido (.next/standalone/server.js) para una
  // imagen Docker mínima. Lo consume el Dockerfile del repo.
  output: 'standalone',
  // Ancla el file-tracing a ESTE repo. Sin esto, Next infiere mal el root si
  // hay lockfiles en directorios padre (ej. ~/package-lock.json) y anida el
  // server.js bajo .next/standalone/<ruta>/, rompiendo el COPY del Dockerfile.
  outputFileTracingRoot: path.resolve(__dirname),
  // nginx ya expone el server adelante; ocultamos el header X-Powered-By.
  poweredByHeader: false,
};

export default nextConfig;
