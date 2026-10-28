"""Read-only status evidence for the explicitly queued address deployment."""
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

out = Path(__file__).resolve().parent
query = """SELECT json_build_object(
 'deployment_uuid',deployment_uuid,'application_id',application_id,'commit',commit,
 'status',status,'created_at',created_at,'updated_at',updated_at,'finished_at',finished_at)
 FROM application_deployment_queues
 WHERE application_id='36' AND deployment_uuid='bdaria3u7eqm3h10ritvlwmi';"""
command = ['ssh', '-F', '/dev/null', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
           '-o', 'ConnectTimeout=10', 'root@213.199.45.205',
           "docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on' coolify-db psql -X -U coolify -d coolify -At"]
row = json.loads(subprocess.check_output(command, input=query, text=True, timeout=30))
row['observed_at'] = datetime.now(timezone.utc).isoformat()
assert row['commit'] == '41554245629a0e89aa249b22694082041dba698d', row
with (out / 'frontend-deployment-status.jsonl').open('a') as handle:
    handle.write(json.dumps(row) + '\n')
print(json.dumps(row))
