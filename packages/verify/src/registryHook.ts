/**
 * @license SPDX-License-Identifier: Apache-2.0
 * National Interoperability Registry Hook (Simulated)
 * Implements: FR-IO-03, FR-IO-04 (additive, never blocks or throws), Hard Rule 6 (clearly labeled simulated)
 */

import { NationalRegistryResult, RegistryCheckOptions } from './types.ts';

/**
 * Checks batch and GTIN against national medicine registry.
 * Critical invariant: MUST NEVER BLOCK OR THROW.
 * If endpoint times out or errors, returns status: 'unavailable'.
 */
export async function checkNationalRegistry(
  gtin: string,
  batchNumber: string,
  options?: RegistryCheckOptions
): Promise<NationalRegistryResult> {
  const timeoutMs = options?.timeoutMs ?? 1500;
  const endpoint = options?.registryEndpoint ?? '/api/registry/check';

  const defaultUnavailable: NationalRegistryResult = {
    registered: false,
    status: 'unavailable',
    registryName: 'Ethiopian FDA National Medicine Registry (Simulated)',
    checkedAt: new Date().toISOString(),
    isSimulated: true,
  };

  try {
    // If custom fetcher provided (e.g. for unit testing or direct mock)
    if (options?.customFetcher) {
      const customPromise = options.customFetcher(gtin, batchNumber);
      const timeoutPromise = new Promise<{ registered: boolean; nationalDrugCode?: string }>((_, reject) =>
        setTimeout(() => reject(new Error('Registry check timed out')), timeoutMs)
      );

      const res = await Promise.race([customPromise, timeoutPromise]);
      return {
        registered: res.registered,
        status: res.registered ? 'confirmed' : 'unregistered',
        registryName: 'Ethiopian FDA National Medicine Registry (Simulated)',
        nationalDrugCode: res.nationalDrugCode,
        checkedAt: new Date().toISOString(),
        isSimulated: true,
      };
    }

    // Standard HTTP fetch with AbortController timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // In browser or Node environment
      const url = `${endpoint}?gtin=${encodeURIComponent(gtin)}&batch=${encodeURIComponent(batchNumber)}`;
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timer);

      if (!response.ok) {
        return defaultUnavailable;
      }

      const json = await response.json();
      return {
        registered: Boolean(json.registered),
        status: json.registered ? 'confirmed' : 'unregistered',
        registryName: 'Ethiopian FDA National Medicine Registry (Simulated)',
        nationalDrugCode: json.nationalDrugCode || json.ndc,
        checkedAt: new Date().toISOString(),
        isSimulated: true,
      };
    } catch {
      clearTimeout(timer);
      return defaultUnavailable;
    }
  } catch {
    // Top-level catch guarantee: never throws under any circumstance
    return defaultUnavailable;
  }
}
