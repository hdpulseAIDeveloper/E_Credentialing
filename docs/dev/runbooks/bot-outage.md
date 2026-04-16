# Runbook: Bot outage (all runs of one type failing)

## Symptoms

- Multiple `BotRun` rows of the same type (e.g., License Verification) moving to `FAILED`.
- Bull Board shows repeated retries with similar error messages.
- Alerts from `AlertService` firing for a specific bot type.

## Likely causes

1. External website layout changed (selectors broken).
2. External site is down or rate-limiting Essen's IP.
3. Credentials rotated at the external site.
4. Playwright crashed on startup (worker container issue).

## Procedure

### 1. Confirm scope

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker logs ecred-worker-prod --tail 200 | grep -i <bot-type>"
```

- If only one bot type fails → external site issue.
- If all bots fail → Playwright / worker issue.

### 2. Freeze triggers (optional)

If the bot is clearly broken and you don't want staff to keep triggering it:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-web-prod sh -c \"echo 'DISABLED_BOTS=LICENSE_VERIFICATION' >> .env\""
# Re-deploy or hot-restart web
```

*(Feature flag wiring for bot disablement is on the roadmap; for now toggle via env.)*

### 3. Test manually

Run the failing bot locally in headed mode against a synthetic provider:

```bash
npm run bot:headed -- --bot=<BOT_TYPE> --providerId=<id>
```

Watch the browser. Identify the failure point:

- Selector not found → site layout changed.
- Login page after login → credentials rotated or session limit.
- Captcha → escalate to set status `REQUIRES_MANUAL`; patch the bot to detect and degrade.

### 4. Patch

- If selector change: update `src/workers/bots/<bot>.ts` and add a fixture snapshot test to prevent regression.
- If credentials rotated: rotate the Key Vault secret and redeploy (no code change needed).
- If captcha introduced: implement captcha detection → set status `REQUIRES_MANUAL` with a clear reason. Notify the credentialing team.

### 5. Replay failed runs

```bash
# Via tRPC from an admin account
# Or via Bull Board: Queues → bot-runs → Failed → Retry
```

## Validation

- Recent `BotRun` rows for that bot type move to `COMPLETED`.
- No new failures for 1 hour.
- Bull Board failure rate back to baseline.

## Prevention

- Add the fixture snapshot for the parsed output of this bot.
- Consider adding a synthetic monitor that runs once an hour on a test provider.
