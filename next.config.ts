import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
