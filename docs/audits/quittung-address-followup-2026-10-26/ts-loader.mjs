import { resolve as baseResolve, load as baseLoad } from '../quittung-layout-2026-10-26/ts-loader.mjs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/integrations/supabase/client') return { url: 'audit:supabase', shortCircuit: true };
  return baseResolve(specifier, context, nextResolve);
}

export async function load(url, context, nextLoad) {
  if (url === 'audit:supabase') return {
    format: 'module', shortCircuit: true,
    source: 'export const supabase = { functions: { invoke: (...args) => globalThis.__receiptAddressAuditInvoke(...args) } };',
  };
  return baseLoad(url, context, nextLoad);
}
