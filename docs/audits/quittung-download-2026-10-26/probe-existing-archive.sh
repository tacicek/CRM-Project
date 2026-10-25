#!/usr/bin/env bash
# Existing-archive read only. Credentials and object paths never reach stdout.
set -euo pipefail
cd "$(dirname "$0")/../../.."
. scripts/prod-readonly.sh
prod_require_target
prod_require_read_confirm
prod_connect
prod_check_identity
: "${CRM_PROD_EDGE_CONTAINER:?CRM_PROD_EDGE_CONTAINER required}"
: "${CRM_PUBLIC_ORIGIN:?CRM_PUBLIC_ORIGIN must be the independently verified HTTPS CRM origin}"
prod_pruefe_name "$CRM_PROD_EDGE_CONTAINER" 'A-Za-z0-9_.-' 'CRM_PROD_EDGE_CONTAINER'
export QUITTUNG_PROBE_ARCHIVE
QUITTUNG_PROBE_ARCHIVE="$(prod_scalar "SELECT coalesce((SELECT json_build_object('path',pdf_path,'sha256',sha256)::text FROM public.quittung_documents ORDER BY created_at DESC LIMIT 1),'null')")"
python3 - <<'PY'
import hashlib, json, os, re, subprocess, urllib.error, urllib.parse, urllib.request

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def run():
    archive = json.loads(os.environ.pop('QUITTUNG_PROBE_ARCHIVE'))
    if archive is None:
        return {'archive_available': False}
    origin = urllib.parse.urlparse(os.environ['CRM_PUBLIC_ORIGIN'])
    if (origin.scheme != 'https' or not origin.hostname or origin.username or origin.password
        or origin.query or origin.fragment or origin.path not in ('', '/')):
        raise ValueError('Invalid public HTTPS origin')
    path = archive['path']
    if not re.fullmatch(r'[0-9a-f-]+/quittung/[0-9a-f-]+/[1-9][0-9]*/[0-9a-f]{64}\.pdf', path):
        raise ValueError('Invalid receipt archive path')
    base = urllib.parse.urlunparse((origin.scheme, origin.netloc, '', '', '', ''))
    ssh = ['ssh', '-F', os.environ.get('CRM_PROD_SSH_CONFIG', '/dev/null'),
           '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=15', os.environ['CRM_PROD_SSH']]
    credential = subprocess.run(ssh + ['docker exec ' + os.environ['CRM_PROD_EDGE_CONTAINER']
        + ' printenv SUPABASE_SERVICE_ROLE_KEY'], capture_output=True, text=True, check=True).stdout.strip()
    if not credential:
        raise ValueError('Missing service credential')
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request(base + '/storage/v1/object/sign/document-pdfs/' + urllib.parse.quote(path, safe='/'),
        data=json.dumps({'expiresIn': 60}).encode(), method='POST',
        headers={'Authorization': 'Bearer ' + credential, 'apikey': credential, 'Content-Type': 'application/json'})
    with opener.open(request, timeout=25) as response:
        sign_status = response.status
        signed = json.load(response)
    credential = None
    value = signed.get('signedURL') or signed.get('signedUrl')
    if not isinstance(value, str):
        raise ValueError('Missing read signature')
    signed_url = urllib.parse.urlparse(value)
    route = signed_url.path
    if route.startswith('/object/sign/document-pdfs/'):
        route = '/storage/v1' + route
    if not route.startswith('/storage/v1/object/sign/document-pdfs/'):
        raise ValueError('Unexpected signed route')
    download = base + route + ('?' + signed_url.query if signed_url.query else '')
    with opener.open(download, timeout=25) as response:
        data = response.read(15728641)
        result = {'archive_available': True, 'sign_http_status': sign_status,
            'download_http_status': response.status, 'bytes': len(data),
            'pdf_magic': data.startswith(b'%PDF-'),
            'within_bucket_limit': len(data) <= 15728640,
            'sha256_matches_archive': hashlib.sha256(data).hexdigest() == archive['sha256'],
            'user_impersonation': False, 'persistent_writes': False}
    return result

try:
    result = run()
    print(json.dumps(result))
    if result.get('archive_available') and not (result.get('pdf_magic') and result.get('sha256_matches_archive')):
        raise SystemExit(1)
except urllib.error.HTTPError as error:
    print(json.dumps({'error_type': 'HTTPError', 'http_status': error.code, 'details': 'redacted'}))
    raise SystemExit(1)
except Exception as error:
    print(json.dumps({'error_type': type(error).__name__, 'details': 'redacted'}))
    raise SystemExit(1)
PY
unset QUITTUNG_PROBE_ARCHIVE
prod_recheck_identity
