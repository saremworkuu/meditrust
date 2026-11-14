/**
 * @license SPDX-License-Identifier: Apache-2.0
 * Supabase Client Factory (Task 6)
 * Exports:
 * 1. supabaseBrowserClient (Anon key, RLS enabled, safe for browser)
 * 2. getSupabaseServerClient() (Service role key, server-only, throws if accessed in browser)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_SUPABASE_URL) ||
  'https://your-project-id.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  'your_supabase_anon_key_here';

/**
 * 1. Client-Side Browser Client
 * Governed by Row Level Security policies. Safe to expose to client bundle.
 */
export const supabaseBrowserClient: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 2. Server-Side Service Client
 * Bypasses Row Level Security for background workers and anomaly aggregation.
 * SECURITY INVARIANT: Must NEVER be called from browser client code.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('SECURITY VIOLATION: getSupabaseServerClient() must only be called on the server.');
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || serviceRoleKey.includes('your_supabase_service_role')) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing or unconfigured on the server.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Health check helper for the /status dashboard
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; status: number; message: string }> {
  if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
    return {
      success: false,
      status: 400,
      message: 'NEXT_PUBLIC_SUPABASE_URL contains placeholder value',
    };
  }

  try {
    // Attempt a light ping against Supabase REST endpoint
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: supabaseAnonKey,
      },
    });

    if (res.ok || res.status === 200 || res.status === 404) {
      return {
        success: true,
        status: res.status,
        message: 'Supabase REST API reachable',
      };
    }

    return {
      success: false,
      status: res.status,
      message: `Supabase returned HTTP status ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 500,
      message: `Failed to connect to Supabase: ${err.message}`,
    };
  }
}
