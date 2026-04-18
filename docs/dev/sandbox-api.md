# Public sandbox API

The public sandbox lets evaluators hit a representative API surface
without onboarding. It is exposed at `/api/sandbox/v1/*` and is **read
only**, **synthetic**, and **not rate-limited** today (cheap to serve;
real load testing belongs in `/api/v1/*`).

> **Wave**: 5.2 (CVO platform positioning)
> **Anti-weakening**: see STANDARD.md §4.2 — never wire these endpoints
> to live data, never lift the cache headers, never add write methods.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/sandbox/v1/providers` | Paginated list of 25 deterministic synthetic providers. |
| GET | `/api/sandbox/v1/providers/:id` | Full envelope for a single provider (`sandbox-1` … `sandbox-25`). |
| GET | `/api/sandbox/v1/fhir/metadata` | FHIR R4 CapabilityStatement (sandbox flavor). |

Any non-`GET` method returns `405` with an `Allow: GET` header.

## Determinism

All payloads are generated from `src/lib/sandbox/synth.ts`. The module
takes no I/O dependencies and is fully pure — same idx → same payload
in every environment, every time. This is why we can assert exact NPI
checksums in the unit tests without snapshot fixtures.

## Synthetic NPI

We derive each NPI by:

1. Building a 9-digit base by offsetting `123456789` (the canonical
   NCQA fake NPI base) by the provider index.
2. Prepending the CMS AAMC prefix `80840` and computing the ISO 7812
   Luhn check digit.
3. Concatenating the 9-digit base + 1-digit check.

A naïve FHIR client validating NPIs by Luhn passes against the sandbox.

## When to evolve

Add a new endpoint when:

- The new surface is needed for a credible POC, **and**
- The shape mirrors an existing `/api/v1/*` route so onboarding to
  production is just a host swap, **and**
- Synthetic data can express the relevant edge cases without leaking
  PHI or forcing non-deterministic generation.

If any of those isn't true, write an ADR before extending the sandbox.
