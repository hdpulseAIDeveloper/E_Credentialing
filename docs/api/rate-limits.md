# Rate Limits

## Defaults

- **60 requests per minute** per API key (fixed window).
- **Burst allowance**: up to the full 60 in the first second of the window.

These defaults apply unless the Admin has issued a key with a custom limit.

## Headers

On every response:

| Header | Description |
|--------|-------------|
| `x-rate-limit-limit` | The current window allowance |
| `x-rate-limit-remaining` | Requests remaining in the current window |
| `x-rate-limit-reset` | Unix seconds when the window resets |

On a 429 response:

| Header | Description |
|--------|-------------|
| `retry-after` | Seconds to wait before retrying |

## 429 response

REST v1:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Too many requests",
    "requestId": "req_01HF..."
  }
}
```

FHIR:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "throttled",
      "diagnostics": "Rate limit exceeded; retry after 15 seconds"
    }
  ]
}
```

## Strategy for consumers

1. Respect `retry-after` on 429 responses (simple exponential backoff also works).
2. Stay well under the limit — target at most 50% of the allowance to absorb bursts.
3. Cache responses where possible; for example, the Practitioner directory changes infrequently and can be refreshed hourly.
4. Use `_lastUpdated` / `updated_since` filters for incremental sync rather than full pulls.

## Raising limits

Contact your Essen Integration Manager. Higher limits are granted for legitimate integrations based on an assessment of impact on the back-end.

## Implementation note

Today the limiter is in-process (fixed window in memory per web container). It is lightweight and sufficient for current traffic. When we move to multi-replica web containers, the limiter will migrate to a Redis-backed token-bucket to enforce limits globally.
