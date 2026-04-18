# Infrastructure as Code — Azure Container Apps + supporting services

Wave 4.5 — `azd up` deploys the full E-Credentialing CVO platform to a
single Azure resource group via Bicep.

## What gets provisioned

```
rg-<env>
├── log-<token>           Log Analytics workspace
├── appi-<token>          Application Insights (workspace-based)
├── id-<token>            User-assigned managed identity
├── cr<token>             Azure Container Registry (Premium)
├── kv-<token>            Key Vault (RBAC mode)
├── st<token>             Storage Account + 'documents' container
├── psql-<token>          Postgres Flexible Server B1ms + ecred_app DB
├── redis-<token>         Redis Standard C1
├── cae-<token>           Container Apps environment (Consumption)
├── ca-web-<token>        Container App: web (port 6015, external)
└── ca-worker-<token>     Container App: worker (port 6016, internal)
```

## Pre-flight

```bash
az login
az account set --subscription <your-subscription-id>
azd auth login
azd init -t .            # use the current repo as the template
```

## Provision + deploy

```bash
azd up
```

azd will prompt for:

| Variable | Notes |
| --- | --- |
| `AZURE_ENV_NAME` | suffix appended to every resource — keep it short |
| `AZURE_LOCATION` | e.g. `eastus2`, `westus3` |
| `POSTGRES_ADMIN_LOGIN` | default `ecredadmin` |
| `POSTGRES_ADMIN_PASSWORD` | strong password — stored in Key Vault |
| `AUTH_SECRET` | NextAuth signing secret (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | 32-byte base64 PHI key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | public URL — defaults to the *.azurecontainerapps.io FQDN if blank |

Behind the scenes:

1. `azd provision` runs `infra/main.bicep` against your subscription.
2. `azd deploy` builds `Dockerfile.web` + `Dockerfile.worker` via ACR
   remote build, pushes to the registry, and updates the two Container
   Apps to point at the new image tags.
3. The `predeploy` hook in `azure.yaml` is a no-op today (migrations
   run at container boot via `npm run db:migrate:prod` in the web
   container's entrypoint).

## Day-2 operations

| Task | Command |
| --- | --- |
| Inspect outputs | `azd env get-values` |
| Tail web logs | `az containerapp logs show -n ca-web-<token> -g rg-<env> --follow` |
| Roll a secret | `az keyvault secret set --vault-name kv-<token> -n encryption-key --value <new>` (Container Apps picks up the new value on the next revision restart) |
| Restart web | `az containerapp revision restart -g rg-<env> -n ca-web-<token>` |
| Tear down | `azd down --purge --force` |

## Cost guardrails

The defaults are deliberately conservative so a fresh subscription can
run `azd up` without breaching free-tier limits:

- Postgres B1ms: ~$13 / month (32 GB storage)
- Redis Standard C1: ~$80 / month — biggest line item
- Container Apps Consumption: pay-per-vCPU-second, ~$0 idle
- Storage LRS: ~$2 / month for typical document volume
- Log Analytics: 5 GB free / month, then ~$2.30 per GB

For production, override the SKU params in `infra/main.parameters.json`
to (recommended starting point):

- Postgres `Standard_D2s_v3` (General Purpose) + 128 GB storage
- Redis `Premium P1` for VNet integration + persistence
- Storage `Standard_GZRS` for cross-region read

## Security baseline

- All secrets live in Key Vault — no parameter-file plaintext after
  the initial provision.
- The web + worker apps run under a single User-Assigned Managed
  Identity; that UAMI is the only principal granted `Key Vault Secrets
  User`, `AcrPull`, and `Storage Blob Data Contributor`.
- Storage account: `allowBlobPublicAccess: false`, container public
  access `None`. Aligned with `scripts/azure/verify-blob-private.ts`
  (Wave 0.4).
- Postgres firewall is open to "Azure services" (`0.0.0.0/0` is
  Microsoft-internal in this rule, not the public internet) — flip to
  VNet integration before going to production.
- Container Apps ingress is HTTPS-only (`allowInsecure: false`) and
  enforces TLS 1.2 minimum at every hop.

## Anti-weakening notes

Per `docs/qa/STANDARD.md` §4.2:

- DO NOT reduce `minReplicas` below 1 to save money — the worker MUST
  always be running so BullMQ heartbeats don't lapse.
- DO NOT enable `adminUserEnabled` on the registry to "make pulls
  easier" — UAMI + AcrPull is the supported path.
- DO NOT swap Postgres back to Single-Server. Flexible Server is the
  only SKU on the supported upgrade path.
