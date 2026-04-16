# Runbook: Stuck job (QUEUED forever)

## Symptoms

- Jobs accumulate in `QUEUED` state in Bull Board.
- Worker logs show no activity.
- Staff reports that nothing happens after they click "Run now."

## Procedure

### 1. Confirm the worker is alive

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker ps | grep ecred-worker"
ALLOW_DEPLOY=1 python .claude/deploy.py "docker logs ecred-worker-prod --tail 50"
```

If the container isn't running, start it:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "cd /var/www/E_Credentialing && docker compose -f docker-compose.prod.yml up -d ecred-worker-prod"
```

### 2. Confirm Redis is reachable

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-worker-prod node -e \"require('ioredis').createClient({url: process.env.REDIS_URL}).on('ready', ()=>{console.log('ok'); process.exit(0)}).on('error', e=>{console.error(e); process.exit(1)})\""
```

If Redis is unreachable, check the shared Redis container on the host and network.

### 3. Drain the queue

From Bull Board (http://localhost:6025 via tunnel):

- Queue: `bot-runs`
- Failed → Retry All
- Stalled → Process All

### 4. Force-restart the worker

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker restart ecred-worker-prod"
```

## Validation

- `QUEUED` count drops to zero within a minute.
- Recent runs complete normally.
- Liveness probe `/api/ready` returns 200.

## Prevention

- Ensure `BullMQ` consumer concurrency is > 0 (default 1; set higher for high-volume queues).
- Alert on worker heartbeat gap > 5 minutes.
