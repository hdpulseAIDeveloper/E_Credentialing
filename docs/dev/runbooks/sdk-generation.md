# Runbook — Generating SDKs from the OpenAPI 3.1 spec

- **Owner:** API working group
- **Frequency:** every time `docs/api/openapi-v1.yaml` changes (TypeScript) + on demand (Python).
- **Wave:** 10 (introduced 2026-04-18)
- **Related:**
  ADR [0022](../adr/0022-public-rest-v1-sdk.md),
  [`scripts/qa/check-sdk-drift.ts`](../../../scripts/qa/check-sdk-drift.ts),
  [`docs/api/openapi-v1.yaml`](../../api/openapi-v1.yaml).

## When to run this

| Trigger | Section |
|---|---|
| You edited `docs/api/openapi-v1.yaml` | [TypeScript regenerate](#typescript-in-tree-mandatory) |
| `npm run qa:gate` failed with `sdk:check FAIL` | [TypeScript regenerate](#typescript-in-tree-mandatory) |
| A Python customer asks for an SDK | [Python out-of-tree](#python-out-of-tree-on-demand) |
| You want to publish to npm/PyPI | [Publishing](#publishing-future-wave) |

## TypeScript (in-tree, mandatory)

The TypeScript types live under `src/lib/api-client/v1-types.ts` and
are auto-generated. The hand-written `V1Client` class
(`src/lib/api-client/v1.ts`) consumes those types.

### Regenerate

```powershell
npm run sdk:gen
```

This runs `openapi-typescript docs/api/openapi-v1.yaml -o
src/lib/api-client/v1-types.ts`. Diff and commit:

```powershell
git diff src/lib/api-client/v1-types.ts
git add src/lib/api-client/v1-types.ts
git commit -m "chore(sdk): regenerate v1 types"
```

### Verify drift

```powershell
npm run sdk:check
```

Exits non-zero if `v1-types.ts` doesn't match what would be generated
from the current spec. Wired into `npm run qa:gate`.

### Anti-weakening reminder

DO NOT hand-edit `src/lib/api-client/v1-types.ts`. The drift gate
will fail on the next CI run, and the regenerate-then-commit cycle
will overwrite your edits anyway. If you need to tweak the *shape*
of an SDK type, edit the OpenAPI spec instead.

## Python (out-of-tree, on demand)

We deliberately don't ship a Python SDK in this repo (see ADR 0022
for the rationale). Customers vendor whichever Python generator fits
their stack. The two canonical options:

### Option A — `openapi-python-client` (pydantic v2, recommended)

```bash
# Install the generator (one-time)
pipx install openapi-python-client
# or: python -m pip install --user openapi-python-client

# Generate
openapi-python-client generate --url https://your-host/api/v1/openapi.yaml --output-path ./your-org-credentialing

# Or against the file directly
openapi-python-client generate --path docs/api/openapi-v1.yaml --output-path ./your-org-credentialing
```

The generator produces a typed pydantic-v2 client under
`your_org_credentialing/`. `import` and use:

```python
from your_org_credentialing import Client
from your_org_credentialing.api.providers import list_providers

client = Client(base_url="https://your-host", token="<api-key>")
result = list_providers.sync(client=client.with_headers({"Authorization": f"Bearer {api_key}"}))
```

### Option B — `openapi-generator` (fully customisable)

```bash
# Java required
brew install openapi-generator       # macOS
choco install openapi-generator-cli  # Windows
# or: docker run --rm openapitools/openapi-generator-cli ...

openapi-generator generate \
  -i docs/api/openapi-v1.yaml \
  -g python \
  -o ./your-org-credentialing
```

`openapi-generator` is more configurable but produces more code per
endpoint. Pick this if you need a non-pydantic typing library or
async-only output.

### Validation

After generating, smoke-test:

```bash
cd your-org-credentialing
pip install -e .
python -c "from your_org_credentialing import Client; print(Client(base_url='http://localhost:3000'))"
```

## Triage

| Failure | Cause | Fix |
|---|---|---|
| `sdk:check FAIL` in CI | The committed `v1-types.ts` is older than the spec. | `npm run sdk:gen && git add … && git commit`. |
| `openapi-typescript: command not found` | Devdep missing. | `npm install --legacy-peer-deps` from a clean checkout. |
| `openapi-python-client: schema invalid` | Spec uses an OpenAPI 3.1 feature the generator doesn't yet support. | Pin to the latest generator: `pipx upgrade openapi-python-client`. |
| Generator produces empty client | Spec served from URL hit a 404 or auth wall. | Use the in-repo file path instead of the URL. |
| Type errors after regenerate | `v1.ts` references a type the spec no longer declares. | Update `v1.ts` by hand to match — this is the *expected* breaking-change signal. |

## Publishing (future wave)

Currently we vendor the SDK in-tree (TypeScript) and document
generation (Python). Customer demand for a published artifact
(`npm install`, `pip install`) will drive a follow-on ADR. Until
then:

- TypeScript: copy `src/lib/api-client/v1.ts` and `v1-types.ts`
  into your project. Both files are MIT-licensed.
- Python: generate as above and vendor under your own package
  namespace.

## See also

- ADR [0020](../adr/0020-openapi-v1-spec.md) — OpenAPI 3.1 spec
- ADR [0021](../adr/0021-schemathesis-fuzz-harness.md) — Schemathesis fuzz harness
- ADR [0022](../adr/0022-public-rest-v1-sdk.md) — this SDK
- Runbook [Schemathesis fuzz](schemathesis-fuzz.md) — validate behaviour
