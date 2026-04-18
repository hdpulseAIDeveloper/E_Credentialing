"""entra-mfa-status.py — Verification half of B-004 (Entra MFA enforcement).

READ-ONLY. Queries Microsoft Graph for the Conditional Access policies
that target the `ecred-staff` group (or whichever group is named in
ECRED_STAFF_GROUP env var) and reports whether MFA is required.

Authentication:
  Uses DefaultAzureCredential, which tries:
    1. Environment vars (AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET)
    2. Workload identity (Azure Container Apps managed identity)
    3. Az CLI (az login on this workstation)
    4. Visual Studio / VSCode credential

Required Graph application permission:
  Policy.Read.All  (admin-consented, app-only)
  Or delegated:
  Policy.Read.All + Group.Read.All

Output:
  GROUP <objectId> "<displayName>" -> N policies
    - <policyId> "<displayName>" state=enabled grantControls=mfa,compliantDevice
  Verdict: ENFORCED / NOT-ENFORCED / AMBIGUOUS

Exit codes:
  0  -> at least one enabled policy with builtInControls including 'mfa'
        targets the staff group
  1  -> policies exist but none enforce MFA on the staff group
  2  -> no Graph access / group not found / Graph error

Usage:
    python scripts/ops/entra-mfa-status.py
    python scripts/ops/entra-mfa-status.py --group "ecred-staff"

This script does NOT need ALLOW_DEPLOY=1 — it never touches the prod
server, only Microsoft Graph.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _get_token() -> str:
    """Fetch a Graph token via azure-identity. Imports lazily so the script
    can fail fast with a friendly message if azure-identity is not installed."""
    try:
        from azure.identity import DefaultAzureCredential
    except ImportError:
        print(
            "FATAL: azure-identity not installed. Run:\n"
            "    pip install azure-identity\n",
            file=sys.stderr,
        )
        sys.exit(2)

    cred = DefaultAzureCredential()
    token = cred.get_token("https://graph.microsoft.com/.default")
    return token.token


def _graph(token: str, path: str) -> dict:
    """GET against Microsoft Graph. Raises on non-2xx with a helpful body dump."""
    req = Request(f"{GRAPH_BASE}{path}", headers={"Authorization": f"Bearer {token}"})
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"Graph HTTP {e.code} on {path}\n{body}", file=sys.stderr)
        raise
    except URLError as e:
        print(f"Graph network error on {path}: {e}", file=sys.stderr)
        raise


def find_group(token: str, name: str) -> dict | None:
    """Return the first group with the given displayName, or None."""
    safe = name.replace("'", "''")
    res = _graph(token, f"/groups?$filter=displayName eq '{safe}'&$select=id,displayName")
    items = res.get("value", [])
    return items[0] if items else None


def list_policies_for_group(token: str, group_id: str) -> list[dict]:
    """Return Conditional Access policies that include this group."""
    res = _graph(token, "/identity/conditionalAccess/policies")
    out: list[dict] = []
    for p in res.get("value", []):
        users = (p.get("conditions", {}) or {}).get("users", {}) or {}
        include_groups = users.get("includeGroups") or []
        if group_id in include_groups:
            out.append(p)
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--group", default=os.environ.get("ECRED_STAFF_GROUP", "ecred-staff"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    try:
        token = _get_token()
    except Exception as e:  # noqa: BLE001
        print(
            f"FATAL: failed to obtain Graph token via DefaultAzureCredential: {e}\n"
            "       Try `az login` first.",
            file=sys.stderr,
        )
        return 2

    try:
        group = find_group(token, args.group)
    except Exception:
        return 2
    if group is None:
        print(f"FATAL: group '{args.group}' not found in tenant.", file=sys.stderr)
        return 2

    try:
        policies = list_policies_for_group(token, group["id"])
    except Exception:
        return 2

    enforced: list[dict] = []
    other: list[dict] = []
    for p in policies:
        state = p.get("state")
        controls = (p.get("grantControls") or {}).get("builtInControls") or []
        if state == "enabled" and "mfa" in controls:
            enforced.append(p)
        else:
            other.append(p)

    payload = {
        "group_id": group["id"],
        "group_displayName": group["displayName"],
        "policy_count": len(policies),
        "policies": [
            {
                "id": p.get("id"),
                "displayName": p.get("displayName"),
                "state": p.get("state"),
                "builtInControls": (p.get("grantControls") or {}).get("builtInControls") or [],
            }
            for p in policies
        ],
        "verdict": "ENFORCED" if enforced else ("NOT-ENFORCED" if policies else "AMBIGUOUS"),
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"GROUP {group['id']} \"{group['displayName']}\" -> {len(policies)} policies")
        for p in policies:
            controls = (p.get("grantControls") or {}).get("builtInControls") or []
            print(
                f"  - {p.get('id')} \"{p.get('displayName')}\" state={p.get('state')} "
                f"grantControls={','.join(controls) or '(none)'}"
            )
        print(f"\nVerdict: {payload['verdict']}")

    return 0 if enforced else 1


if __name__ == "__main__":
    sys.exit(main())
