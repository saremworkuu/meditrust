import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['NEXT_PUBLIC_', 'VITE_']);

  // Strictly define NEXT_PUBLIC_ variables on process.env so client code can access them.
  // SECURITY INVARIANT: Backend secrets (PRIVATE_KEY, PINATA_JWT, etc.) are NEVER exposed here.
  const publicEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      publicEnvDefines[`process.env.${key}`] = JSON.stringify(value);
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      publicEnvDefines[`process.env.${key}`] = JSON.stringify(value);
    }
  }

  const rootDir = process.cwd();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      ...publicEnvDefines,
    },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    resolve: {
      alias: [
        { find: '@', replacement: rootDir },
        { find: 'packages/verify', replacement: path.resolve(rootDir, 'packages/verify/src/index.ts') },
        // Alias @solana/kit to stub to provide missing error constants for @solana-program/system
        { find: /^@solana\/kit$/, replacement: path.resolve(rootDir, 'src/stubs/solana-kit.ts') },
        // Alias any @solana/kit/<subpath> imports to the corresponding @solana/<subpath> browser bundle
        { find: /^@solana\/kit\/(.*)$/, replacement: path.resolve(rootDir, 'node_modules/@solana/$1/dist/index.browser.mjs') },
        // Alias optional @stripe/stripe-js to stub
        { find: '@stripe/stripe-js', replacement: path.resolve(rootDir, 'src/stubs/stripe-js.ts') },
      ],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
