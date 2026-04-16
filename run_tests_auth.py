"""
ESSEN Credentialing Platform — Authenticated Comprehensive Test Runner
Uses NextAuth credentials login to get a session cookie, then tests all features.
"""
import json
import time
import urllib.request
import urllib.error
import urllib.parse
import ssl
import sys
import os
import http.cookiejar
import random

os.environ["PYTHONIOENCODING"] = "utf-8"
if sys.stdout.encoding != "utf-8":
    sys.stdout = open(sys.stdout.fileno(), mode='w', encoding='utf-8', buffering=1)
    sys.stderr = open(sys.stderr.fileno(), mode='w', encoding='utf-8', buffering=1)

BASE = "http://localhost:6015"
ssl._create_default_https_context = ssl._create_unverified_context

results = []
pass_count = 0
fail_count = 0
skip_count = 0

cookie_jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(cookie_jar),
    urllib.request.HTTPRedirectHandler()
)

def log_result(tc_id, module, test_desc, status, actual="", notes=""):
    global pass_count, fail_count, skip_count
    icon = {"PASS": "P", "FAIL": "F", "SKIP": "S"}.get(status, "?")
    if status == "PASS": pass_count += 1
    elif status == "FAIL": fail_count += 1
    else: skip_count += 1
    results.append({"tc_id": tc_id, "module": module, "test": test_desc, "status": status, "actual": actual, "notes": notes})
    line = f"  [{icon}] {tc_id}: {test_desc} -> {status}"
    if actual and status == "FAIL":
        line += f" | {actual[:100]}"
    print(line)

def fetch(path, method="GET", data=None, expect_status=200, timeout=15, follow_redirects=True):
    url = BASE + path if path.startswith("/") else path
    headers = {"Content-Type": "application/json", "Accept": "text/html,application/json,*/*"}
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        if follow_redirects:
            resp = opener.open(req, timeout=timeout)
        else:
            handler = urllib.request.HTTPHandler()
            no_redirect = urllib.request.build_opener(handler, urllib.request.HTTPCookieProcessor(cookie_jar))
            resp = no_redirect.open(req, timeout=timeout)
        content = resp.read().decode("utf-8", errors="replace")
        return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, content
    except Exception as e:
        return 0, str(e)

def trpc_batch_query(router, procedure, input_data=None):
    if input_data is not None:
        inp = json.dumps({"0": {"json": input_data}})
    else:
        inp = json.dumps({"0": {"json": None}})
    encoded = urllib.parse.quote(inp)
    url = f"{BASE}/api/trpc/{router}.{procedure}?batch=1&input={encoded}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        resp = opener.open(req, timeout=15)
        content = resp.read().decode("utf-8", errors="replace")
        return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, content
    except Exception as e:
        return 0, str(e)

def trpc_batch_mutate(router, procedure, input_data):
    url = f"{BASE}/api/trpc/{router}.{procedure}?batch=1"
    payload = json.dumps({"0": {"json": input_data}})
    req = urllib.request.Request(url, data=payload.encode(), headers={"Content-Type": "application/json", "Accept": "application/json"}, method="POST")
    try:
        resp = opener.open(req, timeout=15)
        content = resp.read().decode("utf-8", errors="replace")
        return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, content
    except Exception as e:
        return 0, str(e)

def parse_trpc_result(body):
    try:
        batch = json.loads(body)
        if isinstance(batch, list) and len(batch) > 0:
            item = batch[0]
            if "result" in item:
                return True, item["result"].get("data", {}).get("json", item["result"])
            elif "error" in item:
                return False, item["error"]
        return False, body
    except:
        return False, body

# ──────────────────────────────────────────────────────────────────────
# STEP 0: AUTHENTICATE
# ──────────────────────────────────────────────────────────────────────
def authenticate(email, password):
    # Get CSRF token
    s, b = fetch("/api/auth/csrf")
    try:
        csrf_data = json.loads(b)
        csrf_token = csrf_data.get("csrfToken", "")
    except:
        csrf_token = ""
    
    # Login via credentials
    login_data = urllib.parse.urlencode({
        "csrfToken": csrf_token,
        "email": email,
        "password": password,
        "redirect": "false",
        "json": "true",
        "callbackUrl": BASE + "/dashboard",
    }).encode()
    
    req = urllib.request.Request(
        f"{BASE}/api/auth/callback/credentials",
        data=login_data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )
    try:
        resp = opener.open(req, timeout=15)
        content = resp.read().decode("utf-8", errors="replace")
        return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8", errors="replace") if e.fp else ""
        return e.code, content
    except Exception as e:
        return 0, str(e)

def verify_session():
    s, b = fetch("/api/auth/session")
    try:
        session = json.loads(b)
        if session and session.get("user"):
            return session["user"]
        return None
    except:
        return None

print("=" * 80)
print("ESSEN CREDENTIALING PLATFORM -- COMPREHENSIVE AUTHENTICATED TESTING")
print(f"Target: {BASE}")
print(f"Start: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 80)

# ======================================================================
# MODULE 0: SMOKE TESTS (pre-auth)
# ======================================================================
print("\n>> MODULE 0: SMOKE TESTS")

s, b = fetch("/")
log_result("TC-0001", "Smoke", "App starts on :6015", "PASS" if s in [200, 307] else "FAIL", f"HTTP {s}")

s, b = fetch("/api/health")
health_ok = False
if s == 200:
    try:
        h = json.loads(b)
        health_ok = h.get("status") == "ok" and h.get("services", {}).get("database") == "ok"
        log_result("TC-0002", "Smoke", "Health endpoint OK + DB connected", "PASS" if health_ok else "FAIL", b[:120])
    except:
        log_result("TC-0002", "Smoke", "Health endpoint OK", "FAIL", "JSON parse error")
else:
    log_result("TC-0002", "Smoke", "Health endpoint OK", "FAIL", f"HTTP {s}")

# ======================================================================
# AUTHENTICATION
# ======================================================================
print("\n>> AUTHENTICATION: Logging in as ADMIN")
AUTH_CONFIGS = [
    ("admin@hdpulseai.com", "Users1!@#$%^", "ADMIN"),
]

auth_success = False
for email, pwd, expected_role in AUTH_CONFIGS:
    s, b = authenticate(email, pwd)
    user = verify_session()
    if user and user.get("email") == email:
        print(f"  [P] Authenticated as {email} (role: {user.get('role', 'unknown')})")
        auth_success = True
        admin_user_id = user.get("id", "")
        log_result("TC-0003", "Auth", f"Login as {expected_role} via credentials", "PASS", f"User: {email}")
        break
    else:
        print(f"  [F] Failed to authenticate as {email}: HTTP {s}")
        log_result("TC-0003", "Auth", f"Login as {expected_role} via credentials", "FAIL", f"HTTP {s}, session={user}")

if not auth_success:
    print("\n!! CRITICAL: Cannot authenticate. Aborting tests.")
    with open("test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    sys.exit(1)

# ======================================================================
# MODULE 1: ALL PAGES RENDER WITH AUTH
# ======================================================================
print("\n>> MODULE 1: PAGE RENDERING (Authenticated)")

pages = [
    ("TC-0010", "/dashboard", "Staff Dashboard"),
    ("TC-0011", "/providers", "Provider List"),
    ("TC-0012", "/committee", "Committee Dashboard"),
    ("TC-0013", "/committee/sessions/new", "New Committee Session"),
    ("TC-0014", "/enrollments", "Enrollments List"),
    ("TC-0015", "/expirables", "Expirables List"),
    ("TC-0016", "/medicaid", "NY Medicaid Dashboard"),
    ("TC-0017", "/medicaid/new", "New Medicaid Enrollment"),
    ("TC-0018", "/admin", "Admin Dashboard"),
    ("TC-0019", "/admin/users", "Admin Users"),
    ("TC-0020", "/admin/roles", "Admin Roles"),
    ("TC-0021", "/admin/provider-types", "Admin Provider Types"),
    ("TC-0022", "/admin/settings", "Admin Settings"),
    ("TC-0023", "/admin/workflows", "Admin Workflows"),
    ("TC-0024", "/application", "Provider Application"),
    ("TC-0025", "/application/documents", "Document Upload"),
    ("TC-0026", "/application/attestation", "Attestation Page"),
    ("TC-0027", "/auth/signin", "Sign-In Page"),
    ("TC-0028", "/auth/register", "Registration Page"),
]

for tc_id, path, name in pages:
    s, b = fetch(path, timeout=20)
    is_html = "<html" in b.lower() or "<!doctype" in b.lower() or "__NEXT_DATA__" in b
    is_ok = s == 200 and is_html
    actual = f"HTTP {s}, len={len(b)}, html={is_html}"
    log_result(tc_id, "Pages", f"{name} ({path})", "PASS" if is_ok else "FAIL", actual)

# ======================================================================
# MODULE 2: tRPC QUERY ENDPOINTS
# ======================================================================
print("\n>> MODULE 2: tRPC QUERY ENDPOINTS")

query_tests = [
    ("TC-0100", "provider", "list", {}, "Provider list query"),
    ("TC-0101", "committee", "listSessions", {}, "Committee sessions list"),
    ("TC-0102", "committee", "getQueue", None, "Committee queue"),
    ("TC-0103", "enrollment", "list", {}, "Enrollment list"),
    ("TC-0104", "expirable", "list", {}, "Expirable list"),
    ("TC-0105", "expirable", "getSummary", None, "Expirable summary"),
    ("TC-0106", "medicaid", "list", {}, "Medicaid list"),
    ("TC-0107", "medicaid", "getSummary", None, "Medicaid summary"),
    ("TC-0108", "admin", "listUsers", {}, "Admin users list"),
    ("TC-0109", "admin", "listProviderTypes", None, "Provider types list"),
    ("TC-0110", "admin", "getStats", None, "Admin stats"),
    ("TC-0111", "admin", "listSettings", {}, "App settings list"),
    ("TC-0112", "admin", "listWorkflows", {}, "Workflows list"),
    ("TC-0113", "sanctions", "getFlagged", None, "Flagged sanctions"),
    ("TC-0114", "npdb", "getAdverse", None, "Adverse NPDB"),
    ("TC-0115", "task", "list", {}, "Tasks list"),
]

provider_ids = []
session_ids = []
enrollment_ids = []

for tc_id, router, proc, inp, name in query_tests:
    s, b = trpc_batch_query(router, proc, inp)
    ok, data = parse_trpc_result(b)
    if ok:
        actual = f"HTTP {s}, data_type={type(data).__name__}"
        if isinstance(data, list):
            actual += f", count={len(data)}"
            if router == "provider" and proc == "list":
                provider_ids = [p["id"] for p in data[:5] if isinstance(p, dict) and "id" in p]
            elif router == "committee" and proc == "listSessions":
                session_ids = [s_item["id"] for s_item in data[:3] if isinstance(s_item, dict) and "id" in s_item]
            elif router == "enrollment" and proc == "list":
                enrollment_ids = [e["id"] for e in data[:3] if isinstance(e, dict) and "id" in e]
        elif isinstance(data, dict):
            actual += f", keys={list(data.keys())[:5]}"
        log_result(tc_id, "API Query", f"{router}.{proc}: {name}", "PASS", actual)
    else:
        log_result(tc_id, "API Query", f"{router}.{proc}: {name}", "FAIL", f"HTTP {s}, error={str(data)[:100]}")

# ======================================================================
# MODULE 3: tRPC GET-BY-ID QUERIES
# ======================================================================
print("\n>> MODULE 3: tRPC GET-BY-ID QUERIES")

if provider_ids:
    pid = provider_ids[0]
    
    s, b = trpc_batch_query("provider", "getById", {"id": pid})
    ok, data = parse_trpc_result(b)
    if ok and isinstance(data, dict):
        pname = f"{data.get('legalFirstName','')} {data.get('legalLastName','')}"
        log_result("TC-0200", "API Detail", f"provider.getById ({pname})", "PASS", f"status={data.get('status')}")
    else:
        log_result("TC-0200", "API Detail", "provider.getById", "FAIL", f"HTTP {s}, {str(data)[:100]}")
    
    # Provider sub-queries
    for tc_id, router, proc, name in [
        ("TC-0201", "document", "listByProvider", "Documents for provider"),
        ("TC-0202", "document", "getChecklist", "Checklist for provider"),
        ("TC-0203", "bot", "listByProvider", "Bot runs for provider"),
        ("TC-0204", "communication", "listByProvider", "Communications for provider"),
        ("TC-0205", "sanctions", "listByProvider", "Sanctions for provider"),
        ("TC-0206", "npdb", "listByProvider", "NPDB for provider"),
        ("TC-0207", "expirable", "listByProvider", "Expirables for provider"),
        ("TC-0208", "provider", "getAuditTrail", "Audit trail for provider"),
    ]:
        s, b = trpc_batch_query(router, proc, {"providerId": pid})
        ok, data = parse_trpc_result(b)
        count = len(data) if isinstance(data, list) else "N/A"
        if ok:
            log_result(tc_id, "API Detail", f"{router}.{proc}: {name}", "PASS", f"count={count}")
        else:
            log_result(tc_id, "API Detail", f"{router}.{proc}: {name}", "FAIL", f"HTTP {s}, {str(data)[:100]}")

if session_ids:
    sid = session_ids[0]
    s, b = trpc_batch_query("committee", "getSession", {"id": sid})
    ok, data = parse_trpc_result(b)
    if ok:
        log_result("TC-0210", "API Detail", "committee.getSession", "PASS", f"status={data.get('status') if isinstance(data,dict) else 'ok'}")
    else:
        log_result("TC-0210", "API Detail", "committee.getSession", "FAIL", f"HTTP {s}, {str(data)[:100]}")

if enrollment_ids:
    eid = enrollment_ids[0]
    s, b = trpc_batch_query("enrollment", "getById", {"id": eid})
    ok, data = parse_trpc_result(b)
    if ok:
        log_result("TC-0211", "API Detail", "enrollment.getById", "PASS", f"payer={data.get('payerName') if isinstance(data,dict) else 'ok'}")
    else:
        log_result("TC-0211", "API Detail", "enrollment.getById", "FAIL", f"HTTP {s}, {str(data)[:100]}")

# ======================================================================
# MODULE 4: PAGE RENDERING WITH DATA (Dynamic Routes)
# ======================================================================
print("\n>> MODULE 4: DYNAMIC PAGE RENDERING")

if provider_ids:
    pid = provider_ids[0]
    s, b = fetch(f"/providers/{pid}", timeout=20)
    is_html = "__NEXT_DATA__" in b or "<html" in b.lower()
    log_result("TC-0300", "Dynamic Pages", f"Provider detail /providers/[id]", "PASS" if s == 200 and is_html else "FAIL", f"HTTP {s}")

    s, b = fetch(f"/providers/{pid}/bots", timeout=20)
    is_html = "__NEXT_DATA__" in b or "<html" in b.lower()
    log_result("TC-0301", "Dynamic Pages", f"Provider bots /providers/[id]/bots", "PASS" if s == 200 and is_html else "FAIL", f"HTTP {s}")

if session_ids:
    sid = session_ids[0]
    s, b = fetch(f"/committee/sessions/{sid}", timeout=20)
    is_html = "__NEXT_DATA__" in b or "<html" in b.lower()
    log_result("TC-0302", "Dynamic Pages", f"Committee session detail", "PASS" if s == 200 and is_html else "FAIL", f"HTTP {s}")

if enrollment_ids:
    eid = enrollment_ids[0]
    s, b = fetch(f"/enrollments/{eid}", timeout=20)
    is_html = "__NEXT_DATA__" in b or "<html" in b.lower()
    log_result("TC-0303", "Dynamic Pages", f"Enrollment detail", "PASS" if s == 200 and is_html else "FAIL", f"HTTP {s}")

# ======================================================================
# MODULE 5: MUTATION TESTS (Non-destructive)
# ======================================================================
print("\n>> MODULE 5: tRPC MUTATION TESTS")

test_provider_id = None
test_task_id = None
test_enrollment_id = None
test_expirable_id = None
test_medicaid_id = None
test_session_id = None
test_workflow_id = None
test_committee_provider_id = None

# Get provider types for creation test
s, b = trpc_batch_query("admin", "listProviderTypes")
ok, pt_data = parse_trpc_result(b)
provider_type_id = None
if ok and isinstance(pt_data, list) and len(pt_data) > 0:
    provider_type_id = pt_data[0].get("id")

# 5.1 Create a test provider
if provider_type_id:
    test_npi = f"999{random.randint(1000000, 9999999)}"
    s, b = trpc_batch_mutate("provider", "create", {
        "legalFirstName": "TestQA",
        "legalLastName": "AutomatedRun",
        "providerTypeId": provider_type_id,
        "personalEmail": f"testqa{random.randint(1000,9999)}@example.com",
        "npi": test_npi,
    })
    ok, data = parse_trpc_result(b)
    test_provider_id = data.get("id") if ok and isinstance(data, dict) else None
    log_result("TC-0400", "Mutations", "provider.create", "PASS" if ok and test_provider_id else "FAIL",
              f"id={test_provider_id}" if test_provider_id else f"HTTP {s}, {str(data)[:100]}")
else:
    test_provider_id = None
    log_result("TC-0400", "Mutations", "provider.create", "SKIP", "No provider type ID available")

# 5.2 Update provider
if test_provider_id:
    s, b = trpc_batch_mutate("provider", "update", {"id": test_provider_id, "notes": "QA automated test provider"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0401", "Mutations", "provider.update", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.3 Provider status transition
if test_provider_id:
    s, b = trpc_batch_mutate("provider", "transitionStatus", {"id": test_provider_id, "newStatus": "ONBOARDING_IN_PROGRESS"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0402", "Mutations", "provider.transitionStatus (INVITED->ONBOARDING)", "PASS" if ok else "FAIL",
              f"HTTP {s}, {str(data)[:100]}")

# 5.4 COI update
if test_provider_id:
    s, b = trpc_batch_mutate("provider", "updateCoi", {"providerId": test_provider_id, "status": "PENDING_OUTREACH"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0403", "Mutations", "provider.updateCoi", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.5 Onsite meeting update
if test_provider_id:
    s, b = trpc_batch_mutate("provider", "updateOnsiteMeeting", {"providerId": test_provider_id, "status": "PENDING"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0404", "Mutations", "provider.updateOnsiteMeeting", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.6 Create task
if test_provider_id:
    s, b = trpc_batch_mutate("task", "create", {
        "providerId": test_provider_id,
        "title": "QA Test Task",
        "description": "Automated test task",
        "assignedToId": admin_user_id,
        "priority": "MEDIUM",
    })
    ok, data = parse_trpc_result(b)
    test_task_id = data.get("id") if ok and isinstance(data, dict) else None
    log_result("TC-0405", "Mutations", "task.create", "PASS" if ok and test_task_id else "FAIL",
              f"id={test_task_id}" if test_task_id else f"HTTP {s}, {str(data)[:100]}")

# 5.7 Update task
if test_task_id:
    s, b = trpc_batch_mutate("task", "update", {"id": test_task_id, "status": "IN_PROGRESS"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0406", "Mutations", "task.update", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.8 Add task comment
if test_task_id:
    s, b = trpc_batch_mutate("task", "addComment", {"taskId": test_task_id, "body": "QA automated test comment"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0407", "Mutations", "task.addComment", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.9 Add internal note
if test_provider_id:
    s, b = trpc_batch_mutate("communication", "addInternalNote", {
        "providerId": test_provider_id,
        "body": "QA automated internal note",
    })
    ok, data = parse_trpc_result(b)
    log_result("TC-0408", "Mutations", "communication.addInternalNote", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.10 Log phone call
if test_provider_id:
    s, b = trpc_batch_mutate("communication", "logPhoneCall", {
        "providerId": test_provider_id,
        "direction": "OUTBOUND",
        "body": "QA automated phone call log",
    })
    ok, data = parse_trpc_result(b)
    log_result("TC-0409", "Mutations", "communication.logPhoneCall", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.11 Create enrollment
if test_provider_id:
    s, b = trpc_batch_mutate("enrollment", "create", {
        "providerId": test_provider_id,
        "payerName": "QA Test Payer",
        "enrollmentType": "DELEGATED",
        "submissionMethod": "EMAIL",
    })
    ok, data = parse_trpc_result(b)
    test_enrollment_id = data.get("id") if ok and isinstance(data, dict) else None
    log_result("TC-0410", "Mutations", "enrollment.create", "PASS" if ok and test_enrollment_id else "FAIL",
              f"id={test_enrollment_id}" if test_enrollment_id else f"HTTP {s}, {str(data)[:100]}")

# 5.12 Update enrollment status
if test_enrollment_id:
    s, b = trpc_batch_mutate("enrollment", "updateStatus", {"id": test_enrollment_id, "status": "SUBMITTED"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0411", "Mutations", "enrollment.updateStatus", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.13 Add enrollment follow-up
if test_enrollment_id:
    s, b = trpc_batch_mutate("enrollment", "addFollowUp", {"enrollmentId": test_enrollment_id, "outcome": "QA test follow-up"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0412", "Mutations", "enrollment.addFollowUp", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.14 Create expirable
if test_provider_id:
    s, b = trpc_batch_mutate("expirable", "create", {
        "providerId": test_provider_id,
        "expirableType": "BLS",
        "expirationDate": "2027-12-31T00:00:00.000Z",
        "status": "CURRENT",
    })
    ok, data = parse_trpc_result(b)
    test_expirable_id = data.get("id") if ok and isinstance(data, dict) else None
    log_result("TC-0413", "Mutations", "expirable.create", "PASS" if ok and test_expirable_id else "FAIL",
              f"id={test_expirable_id}" if test_expirable_id else f"HTTP {s}, {str(data)[:100]}")

# 5.15 Create Medicaid enrollment
if test_provider_id:
    s, b = trpc_batch_mutate("medicaid", "create", {
        "providerId": test_provider_id,
        "enrollmentSubtype": "INDIVIDUAL",
        "enrollmentPath": "NEW_PSP",
    })
    ok, data = parse_trpc_result(b)
    test_medicaid_id = data.get("id") if ok and isinstance(data, dict) else None
    log_result("TC-0414", "Mutations", "medicaid.create", "PASS" if ok and test_medicaid_id else "FAIL",
              f"id={test_medicaid_id}" if test_medicaid_id else f"HTTP {s}, {str(data)[:100]}")

# 5.16 Medicaid PSP update
if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "updatePsp", {"id": test_medicaid_id, "pspRegistered": True})
    ok, data = parse_trpc_result(b)
    log_result("TC-0415", "Mutations", "medicaid.updatePsp (register)", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.17 Medicaid PSP login provided
if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "updatePsp", {"id": test_medicaid_id, "pspLoginProvided": True})
    ok, data = parse_trpc_result(b)
    log_result("TC-0416", "Mutations", "medicaid.updatePsp (login)", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.18 Medicaid record submission
if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "recordSubmission", {"id": test_medicaid_id})
    ok, data = parse_trpc_result(b)
    log_result("TC-0417", "Mutations", "medicaid.recordSubmission", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.19 Medicaid group affiliation
if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "updateGroupAffiliation", {"id": test_medicaid_id, "groupAffiliationUpdated": True})
    ok, data = parse_trpc_result(b)
    log_result("TC-0418", "Mutations", "medicaid.updateGroupAffiliation", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.20 Medicaid ETIN confirmation
if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "confirmEtin", {
        "id": test_medicaid_id,
        "etinNumber": "QA-ETIN-001",
        "etinExpirationDate": "2028-06-30T00:00:00.000Z",
    })
    ok, data = parse_trpc_result(b)
    log_result("TC-0419", "Mutations", "medicaid.confirmEtin", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.21 Medicaid add follow-up
if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "addFollowUp", {"id": test_medicaid_id, "notes": "QA test follow-up note"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0420", "Mutations", "medicaid.addFollowUp", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.22 Admin: Upsert setting
s, b = trpc_batch_mutate("admin", "upsertSetting", {"key": "qa_test_setting", "value": "test_value", "group": "testing"})
ok, data = parse_trpc_result(b)
log_result("TC-0421", "Mutations", "admin.upsertSetting", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.23 Admin: Delete setting
if ok:
    s, b = trpc_batch_mutate("admin", "deleteSetting", {"key": "qa_test_setting"})
    ok2, data2 = parse_trpc_result(b)
    log_result("TC-0422", "Mutations", "admin.deleteSetting", "PASS" if ok2 else "FAIL", f"HTTP {s}")

# 5.24 Committee: Create session
s, b = trpc_batch_mutate("committee", "createSession", {
    "sessionDate": "2026-05-15T00:00:00.000Z",
    "sessionTime": "10:00 AM",
    "location": "QA Test Room",
    "committeeMemberIds": [],
})
ok, data = parse_trpc_result(b)
test_session_id = data.get("id") if ok and isinstance(data, dict) else None
log_result("TC-0423", "Mutations", "committee.createSession", "PASS" if ok and test_session_id else "FAIL",
          f"id={test_session_id}" if test_session_id else f"HTTP {s}, {str(data)[:100]}")

# 5.25 Committee: Add provider to session
if test_session_id and test_provider_id:
    s, b = trpc_batch_mutate("committee", "addProvider", {"sessionId": test_session_id, "providerId": test_provider_id})
    ok, data = parse_trpc_result(b)
    test_committee_provider_id = data.get("id") if ok and isinstance(data, dict) else None
    log_result("TC-0424", "Mutations", "committee.addProvider", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.26 Committee: Update session status
if test_session_id:
    s, b = trpc_batch_mutate("committee", "updateSessionStatus", {"id": test_session_id, "status": "IN_PROGRESS"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0425", "Mutations", "committee.updateSessionStatus", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.27 Sanctions: Trigger check
if test_provider_id:
    s, b = trpc_batch_mutate("sanctions", "triggerCheck", {"providerId": test_provider_id, "source": "OIG"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0426", "Mutations", "sanctions.triggerCheck (OIG)", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# 5.28 NPDB: Trigger query
if test_provider_id:
    s, b = trpc_batch_mutate("npdb", "triggerQuery", {"providerId": test_provider_id, "queryType": "INITIAL"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0427", "Mutations", "npdb.triggerQuery", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# 5.29 Bot: Trigger bot
if test_provider_id:
    s, b = trpc_batch_mutate("bot", "triggerBot", {"providerId": test_provider_id, "botType": "LICENSE_VERIFICATION"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0428", "Mutations", "bot.triggerBot (LICENSE)", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# 5.30 Workflow: Create
s, b = trpc_batch_mutate("admin", "createWorkflow", {
    "name": "QA Test Workflow",
    "description": "Automated test workflow",
    "category": "testing",
})
ok, data = parse_trpc_result(b)
test_workflow_id = data.get("id") if ok and isinstance(data, dict) else None
log_result("TC-0429", "Mutations", "admin.createWorkflow", "PASS" if ok else "FAIL",
          f"id={test_workflow_id}" if test_workflow_id else f"HTTP {s}, {str(data)[:100]}")

# 5.31 Workflow: Save scene
if test_workflow_id:
    scene = {"elements": [], "appState": {"viewBackgroundColor": "#f0f0f0"}, "files": {}}
    s, b = trpc_batch_mutate("admin", "saveWorkflow", {"id": test_workflow_id, "sceneData": scene})
    ok, data = parse_trpc_result(b)
    log_result("TC-0430", "Mutations", "admin.saveWorkflow", "PASS" if ok else "FAIL", f"HTTP {s}")

# 5.32 iCIMS Import (stub)
s, b = trpc_batch_mutate("provider", "importFromIcims", {"icimsId": f"IC-QA-{random.randint(10000,99999)}"})
ok, data = parse_trpc_result(b)
log_result("TC-0431", "Mutations", "provider.importFromIcims (stub)", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# 5.33 CAQH Sync (stub)
if provider_ids:
    s, b = trpc_batch_mutate("provider", "pullCaqhData", {"providerId": provider_ids[0]})
    ok, data = parse_trpc_result(b)
    log_result("TC-0432", "Mutations", "provider.pullCaqhData (stub)", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# ======================================================================
# MODULE 6: COMMITTEE PDF GENERATION
# ======================================================================
print("\n>> MODULE 6: COMMITTEE PDF GENERATION")

if session_ids:
    sid = session_ids[0]
    s, b = trpc_batch_mutate("committee", "generateAgenda", {"sessionId": sid})
    ok, data = parse_trpc_result(b)
    log_result("TC-0500", "Committee PDF", "generateAgenda", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

    if provider_ids:
        s, b = trpc_batch_mutate("committee", "generateSummary", {"providerId": provider_ids[0]})
        ok, data = parse_trpc_result(b)
        log_result("TC-0501", "Committee PDF", "generateSummary", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# ======================================================================
# MODULE 7: ENROLLMENT ROSTER
# ======================================================================
print("\n>> MODULE 7: ENROLLMENT ROSTER")

if enrollment_ids:
    s, b = trpc_batch_mutate("enrollment", "generateRoster", {"enrollmentIds": enrollment_ids[:2], "rosterType": "delegated"})
    ok, data = parse_trpc_result(b)
    log_result("TC-0600", "Roster", "generateRoster (delegated)", "PASS" if ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# ======================================================================
# MODULE 8: AUDIT TRAIL VERIFICATION
# ======================================================================
print("\n>> MODULE 8: AUDIT TRAIL")

if test_provider_id:
    s, b = trpc_batch_query("provider", "getAuditTrail", {"providerId": test_provider_id, "page": 1, "limit": 50})
    ok, data = parse_trpc_result(b)
    if ok and isinstance(data, dict):
        audit_items = data.get("items", data.get("logs", []))
        audit_count = len(audit_items) if isinstance(audit_items, list) else 0
    elif ok and isinstance(data, list):
        audit_count = len(data)
    else:
        audit_count = 0
    log_result("TC-0700", "Audit", "Audit trail populated after mutations", 
              "PASS" if ok and audit_count > 0 else "FAIL",
              f"count={audit_count}, data_type={type(data).__name__}")

# ======================================================================
# MODULE 9: NEGATIVE / EDGE CASES
# ======================================================================
print("\n>> MODULE 9: NEGATIVE / EDGE CASES")

# Invalid provider ID
s, b = trpc_batch_query("provider", "getById", {"id": "00000000-0000-0000-0000-000000000000"})
ok, data = parse_trpc_result(b)
log_result("TC-0800", "Negative", "Non-existent provider ID returns error", 
          "PASS" if not ok or data is None else "FAIL", f"HTTP {s}")

# Invalid session ID
s, b = trpc_batch_query("committee", "getSession", {"id": "00000000-0000-0000-0000-000000000000"})
ok, data = parse_trpc_result(b)
log_result("TC-0801", "Negative", "Non-existent session ID returns error",
          "PASS" if not ok or data is None else "FAIL", f"HTTP {s}")

# Invalid Medicaid ID
s, b = trpc_batch_query("medicaid", "getById", {"id": "00000000-0000-0000-0000-000000000000"})
ok, data = parse_trpc_result(b)
log_result("TC-0802", "Negative", "Non-existent medicaid ID returns error",
          "PASS" if not ok or data is None else "FAIL", f"HTTP {s}")

# Create provider with missing required fields
s, b = trpc_batch_mutate("provider", "create", {"firstName": "", "lastName": "", "providerTypeId": ""})
ok, data = parse_trpc_result(b)
log_result("TC-0803", "Negative", "Create provider with empty required fields fails",
          "PASS" if not ok or s in [400, 500] else "FAIL", f"HTTP {s}")

# Duplicate NPI
if test_provider_id:
    s, b = trpc_batch_mutate("provider", "create", {
        "legalFirstName": "Dupe", "legalLastName": "Test", "providerTypeId": provider_type_id, "npi": test_npi
    })
    ok, data = parse_trpc_result(b)
    log_result("TC-0804", "Negative", "Duplicate NPI rejected", 
              "PASS" if not ok else "FAIL", f"HTTP {s}, {str(data)[:100]}")

# ======================================================================
# MODULE 10: AUTH / RBAC ENFORCEMENT
# ======================================================================
print("\n>> MODULE 10: AUTH / RBAC")

# Test with unauthenticated (new cookie jar)
unauth_jar = http.cookiejar.CookieJar()
unauth_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(unauth_jar))

def unauth_fetch(path):
    req = urllib.request.Request(f"{BASE}{path}", headers={"Accept": "application/json"})
    try:
        resp = unauth_opener.open(req, timeout=10)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except:
        return 0, ""

# Protected tRPC endpoints should fail without auth
s, b = unauth_fetch("/api/trpc/admin.listUsers?batch=1&input=" + urllib.parse.quote('{"0":{"json":null}}'))
is_protected = s in [307, 401, 403] or "signin" in b.lower()
log_result("TC-0900", "RBAC", "admin.listUsers blocked without auth", "PASS" if is_protected else "FAIL", f"HTTP {s}")

s, b = unauth_fetch("/api/trpc/provider.list?batch=1&input=" + urllib.parse.quote('{"0":{"json":null}}'))
is_protected = s in [307, 401, 403] or "signin" in b.lower()
log_result("TC-0901", "RBAC", "provider.list blocked without auth", "PASS" if is_protected else "FAIL", f"HTTP {s}")

# ======================================================================
# CLEANUP: Delete test data
# ======================================================================
print("\n>> CLEANUP: Removing test data")

if test_workflow_id:
    trpc_batch_mutate("admin", "deleteWorkflow", {"id": test_workflow_id})
    print("  Deleted test workflow")

if test_enrollment_id:
    trpc_batch_mutate("enrollment", "delete", {"id": test_enrollment_id})
    print("  Deleted test enrollment")

if test_medicaid_id:
    s, b = trpc_batch_mutate("medicaid", "delete" if hasattr(trpc_batch_mutate, "delete") else "updateStatus", 
                             {"id": test_medicaid_id, "status": "ENROLLED"})
    print("  Cleaned test Medicaid enrollment")

# ======================================================================
# SUMMARY
# ======================================================================
print("\n" + "=" * 80)
print("TEST EXECUTION COMPLETE")
print(f"End: {time.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Total: {len(results)} | PASS: {pass_count} | FAIL: {fail_count} | SKIP: {skip_count}")
if len(results) > 0:
    print(f"Pass Rate: {pass_count/len(results)*100:.1f}%")
print("=" * 80)

if fail_count > 0:
    print(f"\n--- FAILURES ({fail_count}) ---")
    for r in results:
        if r["status"] == "FAIL":
            print(f"  [F] {r['tc_id']}: {r['test']}")
            print(f"      Actual: {r['actual'][:150]}")

with open("test_results.json", "w") as f:
    json.dump(results, f, indent=2)
print("\nResults saved to test_results.json")
