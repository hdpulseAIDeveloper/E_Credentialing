# Summary

<!-- What does this PR change? Why? -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor
- [ ] Docs
- [ ] Security fix
- [ ] Test / infra

## How to test

<!-- Paste the commands and manual steps a reviewer should follow. -->

## Checklist

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] `npm test` green
- [ ] `node scripts/forbidden-terms.mjs` clean
- [ ] New Prisma schema changes have a migration in `prisma/migrations/**`
- [ ] PHI fields written in new code use `encryptOptional`/`encrypt`
- [ ] User-facing copy does not reference upgrade/uplift/migration language
- [ ] `docs/status/blocked.md` updated if this change depends on human input
