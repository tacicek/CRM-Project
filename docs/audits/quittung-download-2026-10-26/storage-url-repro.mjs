import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';

// Real handler + real SDK; only HTTP responses are synthetic. No network is used.
const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../..');
const internalBase = 'http://supabase-kong:8000';
const scenarios = [
  { name: 'HTTPS public Supabase origin', publicBase: 'https://api.receipt-audit.invalid', appBase: 'https://crm.receipt-audit.invalid', expectedOrigin: 'https://api.receipt-audit.invalid' },
  { name: 'HTTP public Supabase with HTTPS dashboard Storage proxy', publicBase: 'http://gateway.receipt-audit.invalid', appBase: 'https://crm.receipt-audit.invalid', expectedOrigin: 'https://crm.receipt-audit.invalid' },
  { name: 'Production-shaped HTTP public URL with canonical dashboard default', publicBase: 'http://gateway.receipt-audit.invalid', appBase: undefined, expectedOrigin: 'https://crm-hirschen.ch' },
  { name: 'HTTPS public Supabase with configured path prefix', publicBase: 'https://api.receipt-audit.invalid/supabase/', appBase: 'https://crm.receipt-audit.invalid', expectedOrigin: 'https://api.receipt-audit.invalid', prefix: '/supabase' },
];
const receiptId = '11111111-1111-4111-8111-111111111111';
const companyId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';
const hash = '0'.repeat(64);
const pdfPath = `${companyId}/quittung/${receiptId}/2/${hash}.pdf`;
const signedPath = `/storage/v1/object/sign/document-pdfs/${pdfPath}`;
const signedQuery = '?token=synthetic-storage-signature&download=Receipt%202026.pdf&marker=a+b%2Fc';
const sdkSigningQuery = new URL(encodeURI(`${internalBase}${signedPath}${signedQuery}`)).search;
const receipt = {
  id: receiptId, company_id: companyId, version: 2, issued_at: '2026-10-26T09:00:00Z',
  status: 'paid', payment_status: 'paid', company_snapshot: { company_name: 'Synthetic Company', email: 'office@example.invalid' },
};
const archived = { id: documentId, company_id: companyId, quittung_id: receiptId, version: 2, pdf_path: pdfPath, sha256: hash };
const requests = [];
const fakeFetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  const method = init.method ?? 'GET';
  requests.push({ origin: url.origin, path: url.pathname, method });
  if (url.origin !== internalBase) throw new Error('Unexpected external request in synthetic harness');
  if (url.pathname === '/auth/v1/user') return Response.json({ id: '44444444-4444-4444-8444-444444444444', aud: 'authenticated', role: 'authenticated', email: 'user@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-10-26T00:00:00Z' });
  if (url.pathname === '/rest/v1/quittungen') return Response.json(receipt);
  if (url.pathname === '/rest/v1/company_members') return Response.json({ company_id: companyId });
  if (url.pathname === '/rest/v1/quittung_documents') return Response.json(archived);
  if (url.pathname === signedPath && method === 'POST') {
    // This is Storage's relative API response, before the real SDK adds its base URL.
    return Response.json({ signedURL: `/object/sign/document-pdfs/${pdfPath}${signedQuery}` });
  }
  throw new Error(`Unexpected synthetic request: ${method} ${url.pathname}`);
};

const bundle = await build({ entryPoints: [path.join(root, 'supabase/functions/send-quittung/index.ts')], bundle: true,
  platform: 'node', format: 'cjs', write: false, external: ['https://*'], logLevel: 'silent' });
let handler;
const env = {
  SUPABASE_URL: internalBase, SUPABASE_PUBLIC_URL: scenarios[0].publicBase, DASH_APP_URL: scenarios[0].appBase,
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-not-a-real-key',
};
const errors = [];
runInNewContext(bundle.outputFiles[0].text, {
  module: { exports: {} }, exports: {},
  require: specifier => {
    if (specifier.includes('/http/server.ts')) return { serve: fn => { handler = fn; } };
    if (specifier.includes('@supabase/supabase-js')) return { createClient: (url, key) => createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fakeFetch },
    }) };
    throw new Error(`Unexpected runtime import: ${specifier}`);
  },
  Deno: { env: { get: name => env[name] } },
  Request, Response, Blob, URL, Uint8Array, TextDecoder, TextEncoder, crypto, btoa, atob,
  fetch: fakeFetch,
  console: { error: (...args) => errors.push(args.map(String).join(' ')), warn: () => undefined },
});

const checks = [];
for (const scenario of scenarios) {
env.SUPABASE_PUBLIC_URL = scenario.publicBase;
env.DASH_APP_URL = scenario.appBase;
for (const action of ['lookup', 'archive']) {
  const response = await handler(new Request('https://edge.receipt-audit.invalid/functions/v1/send-quittung', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic-session', Origin: 'https://untrusted-origin.invalid', 'X-Forwarded-Host': 'untrusted-host.invalid' },
    body: JSON.stringify({ action, quittungId: receiptId, version: 2, ...(action === 'archive' ? { sha256: hash, pdfPath } : {}) }),
  }));
  const body = await response.json();
  const returned = typeof body.url === 'string' ? new URL(body.url) : null;
  checks.push({
    scenario: scenario.name, action, status: response.status, documentPreserved: body.document?.id === documentId,
    returnedOrigin: returned?.origin ?? null, expectedOrigin: scenario.expectedOrigin,
    publicOrigin: returned?.origin === scenario.expectedOrigin,
    originalPathPreserved: returned?.pathname === (scenario.prefix ?? '') + signedPath,
    originalTokenPreserved: returned?.searchParams.get('token') === 'synthetic-storage-signature',
    originalSigningQueryPreserved: returned?.search === sdkSigningQuery,
    error: body.error ?? null,
  });
}
}
const result = { passed: checks.every(c => c.status === 200 && c.documentPreserved && c.publicOrigin && c.originalPathPreserved && c.originalTokenPreserved && c.originalSigningQueryPreserved),
  checks, requests, errors,
  note: 'Handler and installed Supabase SDK are real; Auth/PostgREST/Storage HTTP responses are mocked locally. No JWT was minted, no live API contacted.' };
const filename = process.env.AUDIT_RESULT_NAME || 'storage-url-result.json';
await fs.writeFile(path.join(output, filename), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.passed ? 0 : 1;
