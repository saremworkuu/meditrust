/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Environment Variable Validation (Task 1)
 * Uses Zod to assert all required environment variables are present at startup.
 * SECURITY INVARIANT: NEVER PRINTS SECRET VALUES, ONLY VARIABLE NAMES.
 */

import { z } from 'zod';

// Server-only environment variables (Must never leak to client bundle)
export const serverEnvSchema = z.object({
  PRIVATE_KEY: z.string().min(1, 'PRIVATE_KEY is required for backend tasks/deployments'),
  RPC_URL: z.string().url('RPC_URL must be a valid HTTP/HTTPS or WS URL'),
  PINATA_JWT: z.string().min(1, 'PINATA_JWT is required for server-side IPFS pinning'),
  PRIVY_APP_SECRET: z.string().min(1, 'PRIVY_APP_SECRET is required for server authentication'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required for secure DB operations'),
});

// Client-safe environment variables (Publicly readable)
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_CHAIN_ID: z.string().regex(/^\d+$/, 'NEXT_PUBLIC_CHAIN_ID must be a numeric string'),
  NEXT_PUBLIC_RPC_URL: z.string().url('NEXT_PUBLIC_RPC_URL must be a valid URL'),
  NEXT_PUBLIC_EXPLORER_URL: z.string().url('NEXT_PUBLIC_EXPLORER_URL must be a valid URL'),
  NEXT_PUBLIC_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'NEXT_PUBLIC_CONTRACT_ADDRESS must be a valid Ethereum 0x address'),
  NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1, 'NEXT_PUBLIC_PRIVY_APP_ID is required for wallet login'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required for client queries'),
  NEXT_PUBLIC_IPFS_GATEWAY: z.string().url('NEXT_PUBLIC_IPFS_GATEWAY must be a valid URL'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Helper to safely extract env in both Node (process.env) and Vite (import.meta.env)
 */
export function getRawEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};

  // 1. Check Node process.env
  if (typeof process !== 'undefined' && process.env) {
    Object.assign(env, process.env);
  }

  // 2. Check Vite / ESM import.meta.env if available
  try {
    const metaEnv = (import.meta as any).env;
    if (metaEnv) {
      Object.assign(env, metaEnv);
    }
  } catch {}

  return env;
}

/**
 * Validates environment variables at startup.
 * Throws a formatted Error with only the names of missing variables if invalid.
 */
export function validateEnv(isServer: boolean = typeof window === 'undefined'): {
  client: ClientEnv;
  server?: ServerEnv;
} {
  const raw = getRawEnv();

  // Validate Client Vars
  const clientParsed = clientEnvSchema.safeParse(raw);
  if (!clientParsed.success) {
    const missingKeys = clientParsed.error.issues.map((issue) => issue.path.join('.'));
    console.error('❌ [MediTrust Startup Error] Missing or invalid client environment variables:');
    missingKeys.forEach((key) => console.error(`   - ${key}`));
    console.error('👉 Check .env or .env.local. Refer to .env.example for required keys.\n');
    throw new Error(`[Startup Error] Missing client environment variables: ${missingKeys.join(', ')}`);
  }

  // If server-side, validate server secrets
  let serverParsedResult: ServerEnv | undefined;
  if (isServer) {
    const serverParsed = serverEnvSchema.safeParse(raw);
    if (!serverParsed.success) {
      const missingKeys = serverParsed.error.issues.map((issue) => issue.path.join('.'));
      console.error('❌ [MediTrust Startup Error] Missing or invalid server-side environment variables:');
      missingKeys.forEach((key) => console.error(`   - ${key} (SECRET)`));
      console.error('👉 Check .env or .env.local. Refer to .env.example for required keys.\n');
      throw new Error(`[Startup Error] Missing server environment variables: ${missingKeys.join(', ')}`);
    }
    serverParsedResult = serverParsed.data;
  }

  return {
    client: clientParsed.data,
    server: serverParsedResult,
  };
}

/**
 * Health check helper for the /status connection dashboard.
 * Returns boolean status for each variable without revealing secret contents.
 */
export function getEnvHealthSummary(): Record<string, { present: boolean; isSecret: boolean; isPlaceholder: boolean }> {
  const raw = getRawEnv();
  const allKeys = [
    { key: 'PRIVATE_KEY', isSecret: true },
    { key: 'RPC_URL', isSecret: true },
    { key: 'PINATA_JWT', isSecret: true },
    { key: 'PRIVY_APP_SECRET', isSecret: true },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', isSecret: true },
    { key: 'NEXT_PUBLIC_CHAIN_ID', isSecret: false },
    { key: 'NEXT_PUBLIC_RPC_URL', isSecret: false },
    { key: 'NEXT_PUBLIC_EXPLORER_URL', isSecret: false },
    { key: 'NEXT_PUBLIC_CONTRACT_ADDRESS', isSecret: false },
    { key: 'NEXT_PUBLIC_PRIVY_APP_ID', isSecret: false },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', isSecret: false },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', isSecret: false },
    { key: 'NEXT_PUBLIC_IPFS_GATEWAY', isSecret: false },
  ];

  const summary: Record<string, { present: boolean; isSecret: boolean; isPlaceholder: boolean }> = {};

  allKeys.forEach(({ key, isSecret }) => {
    const val = raw[key];
    const present = Boolean(val && val.trim().length > 0);
    const isPlaceholder = Boolean(
      val && (val.includes('placeholder') || val.includes('your_') || val.includes('MY_'))
    );

    summary[key] = {
      present,
      isSecret,
      isPlaceholder,
    };
  });

  return summary;
}
