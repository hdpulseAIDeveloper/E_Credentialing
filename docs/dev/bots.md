# Bots and BullMQ

PSV bots are Playwright scripts hosted in the worker container. Each bot extends `BotBase` and implements `execute()`.

## Queue layout

| Queue | Producer | Consumer |
|-------|----------|----------|
| `bot-runs` | tRPC router, onboarding submit, scheduled recheck | `botWorker` |
| `scheduled` | Cron | `scheduledWorker` |
| `notifications` | Various | `notificationWorker` |
| `enrollments` | Provider approval | `enrollmentWorker` |

Queues are backed by Redis. Bull Board is exposed on `http://localhost:6025` for local observability.

## Adding a new bot

1. Create `src/workers/bots/<name>.ts` extending `BotBase`.
2. Implement `execute(page: Page, ctx: BotContext): Promise<BotResult>`.
3. Return `{ outcome: "completed", parsed, pdfPath }` or set `ctx.run.status = "REQUIRES_MANUAL"` and return accordingly.
4. Register the bot in `src/workers/registry.ts`.
5. Add to `TRIGGERABLE_BOT_TYPES` in `src/server/api/routers/bot.ts` **only if** staff can trigger it manually.
6. Add unit tests in `tests/unit/workers/bots/<name>.test.ts` using mocked `Page`.
7. Add an integration test for the "happy path" parse using a fixture HTML snapshot.

## `BotBase.run` lifecycle

```ts
async run(job: BotJob) {
  const run = await this.markRunning(job);
  try {
    await this.execute(page, { run, ... });
    if (run.status === "REQUIRES_MANUAL") {
      return;                               // subclass handled it
    }
    await this.markCompleted(run);
    await this.writeVerificationRecord(...);
  } catch (err) {
    await this.markFailed(run, err);
    if (job.attemptsMade < this.maxAttempts) throw err;  // BullMQ retries
  } finally {
    await this.tearDown(page);
  }
}
```

Key invariants:

- If the subclass sets status to `REQUIRES_MANUAL`, the base will NOT transition to `COMPLETED` and will NOT write a `VerificationRecord`. Staff must mark it manually.
- Failures exhaust retries then mark `FAILED` and alert.
- The PDF is always uploaded before the status transitions to completed.

## Triggerable bots

`TRIGGERABLE_BOT_TYPES` in `src/server/api/routers/bot.ts` lists bot types staff can trigger manually. System-triggered bots (enrollment submission, expirable renewal) are excluded — they must come from their own workflows to preserve state transitions.

## Scheduled jobs

Defined in `src/workers/index.ts`:

```ts
scheduler.add({ name: "sanctions-recheck", repeat: { cron: "0 2 * * 1" } });  // Monday 02:00
scheduler.add({ name: "expirables-outreach", repeat: { cron: "0 7 * * *" } });
scheduler.add({ name: "roster-generation", repeat: { cron: "0 3 1 * *" } });
```

Consumer logic in `src/workers/jobs/<name>.ts`. Each job is:
- **Idempotent**: safe to re-run; uses `RECENT_CHECK_WINDOW_MS` guards (24h for sanctions).
- **Observable**: logs job id, input size, outcome via `pino`.
- **Guardable**: env flag `SANCTIONS_RECHECK_DISABLED=true` halts the job without code changes.

## Bot context and secrets

Bots receive a `BotContext` with:
- `run` (the `BotRun` row)
- `provider` (subset of the provider record)
- `secrets` — resolved from Azure Key Vault on demand (`dea.totpSecret`, `availity.username`, etc.)
- `page` — fresh Playwright Page

Secrets are fetched just-in-time and never logged. Failed secret fetches fail the bot run.

## Retry policy

- Default: 3 attempts, exponential backoff 30s / 2m / 8m.
- Override per bot by setting `this.maxAttempts` and `this.backoff`.
- After exhausting, the run is `FAILED` and `AlertService` pages the on-call channel.

## Local debugging

```bash
npm run bot:headed -- --bot=LICENSE_VERIFICATION --providerId=<id>
```

This bypasses the queue and runs the bot directly with a visible browser. Useful for iterating on selector changes.

## Common pitfalls

- **Changing external UI**: the state boards change their websites a couple of times a year. Keep selectors resilient (role-based > class-name-based). Add snapshot fixtures for parse logic.
- **Captchas**: the provider sites are allowed to add them any time. On captcha detection, set status to `REQUIRES_MANUAL` with a descriptive reason.
- **DEA MFA**: we use TOTP stored in Key Vault; the `otplib` library generates codes at runtime. If the TOTP seed is rotated, update Key Vault before running the bot again.
- **Rate limits on external sites**: stagger bot runs with `delay` on enqueue when processing bulk.
