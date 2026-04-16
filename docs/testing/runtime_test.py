"""
ESSEN Credentialing Platform - RUNTIME Test Executor v2
Tests the live running application at localhost:6015/6025.
"""
import json, time, re, urllib.request, urllib.error, urllib.parse, ssl
from datetime import datetime

ssl._create_default_https_context = ssl._create_unverified_context
BASE = "http://localhost:6015"
WORKER = "http://localhost:6025"
results = []
session_cookie = None

def req(url, method="GET", body=None, headers=None, timeout=45):
    if headers is None: headers = {}
    headers.setdefault("User-Agent", "EssenQA/2.0")
    if session_cookie: headers["Cookie"] = session_cookie
    if body and isinstance(body, dict):
        body = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    try:
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
        resp = urllib.request.build_opener().open(r, timeout=timeout)
        bt = resp.read().decode("utf-8", errors="replace")
        return (resp.status, bt, dict(resp.headers), None)
    except urllib.error.HTTPError as e:
        bt = ""
        try: bt = e.read().decode("utf-8", errors="replace")
        except: pass
        return (e.code, bt, dict(e.headers) if e.headers else {}, str(e))
    except Exception as e:
        return (0, "", {}, str(e))

def test(tc, mod, desc, url, method="GET", body=None, headers=None,
         expect_status=200, expect_contains=None, expect_not_contains=None,
         expect_json_key=None, pri="P0"):
    start = time.time()
    status, bt, rh, error = req(url, method=method, body=body, headers=headers)
    elapsed = round((time.time() - start) * 1000)
    ok = True; notes = []
    if status != expect_status:
        ok = False; notes.append(f"Expected HTTP {expect_status}, got {status}")
    if expect_contains and ok:
        for t in (expect_contains if isinstance(expect_contains, list) else [expect_contains]):
            if t not in bt: ok = False; notes.append(f"Missing: '{t[:80]}'")
    if expect_not_contains and ok:
        for t in (expect_not_contains if isinstance(expect_not_contains, list) else [expect_not_contains]):
            if t in bt: ok = False; notes.append(f"Unwanted: '{t[:80]}'")
    if expect_json_key and ok:
        try:
            d = json.loads(bt)
            for k in (expect_json_key if isinstance(expect_json_key, list) else [expect_json_key]):
                if k not in d: ok = False; notes.append(f"Missing JSON key: '{k}'")
        except: ok = False; notes.append("Response is not valid JSON")
    if error and status == 0: ok = False; notes.append(f"Error: {error[:100]}")
    r = "PASS" if ok else "FAIL"
    detail = "; ".join(notes) if notes else f"HTTP {status}, {len(bt)}B, {elapsed}ms"
    results.append({"tc": tc, "mod": mod, "desc": desc, "url": url, "method": method,
                     "pri": pri, "result": r, "status": status, "size": len(bt),
                     "ms": elapsed, "detail": detail})
    print(f"  [{r:4s}] {tc}: {desc} -> HTTP {status} ({elapsed}ms) {'; '.join(notes) if notes else ''}")
    return ok, status, bt

def attempt_login(email, password):
    global session_cookie
    s, b, _, _ = req(f"{BASE}/api/auth/csrf")
    if s != 200: return False
    try: csrf = json.loads(b).get("csrfToken", "")
    except: return False
    if not csrf: return False
    data = urllib.parse.urlencode({"csrfToken": csrf, "email": email, "password": password,
                                    "callbackUrl": f"{BASE}/dashboard", "json": "true"}).encode()
    try:
        r = urllib.request.Request(f"{BASE}/api/auth/callback/credentials", data=data,
                                   headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
        resp = urllib.request.build_opener(urllib.request.HTTPCookieProcessor()).open(r, timeout=30)
        cookies = resp.headers.get_all("Set-Cookie") or []
        session_cookie = "; ".join(c.split(";")[0] for c in cookies)
        if session_cookie: print(f"  [AUTH] Login OK ({email})"); return True
    except urllib.error.HTTPError as e:
        cookies = e.headers.get_all("Set-Cookie") or []
        session_cookie = "; ".join(c.split(";")[0] for c in cookies)
        if session_cookie and "next-auth.session-token" in session_cookie:
            print(f"  [AUTH] Login OK via redirect ({email})"); return True
    except Exception as e:
        print(f"  [AUTH] Error: {e}")
    return False

def register_test_user():
    email = f"qa_test_{int(time.time())}@essen.com"
    pwd = "QATest123!"
    s, b, _, _ = req(f"{BASE}/api/auth/register", method="POST",
                     body={"firstName": "QA", "lastName": "Tester", "email": email, "password": pwd})
    if s == 200 or s == 201:
        print(f"  [AUTH] Registered test user: {email}")
        return email, pwd
    else:
        print(f"  [AUTH] Registration failed: HTTP {s}")
        try: print(f"         {json.loads(b).get('error', b[:200])}")
        except: pass
        return None, None

# ================================================================
print("=" * 70)
print("ESSEN CREDENTIALING - RUNTIME TEST v2")
print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"Web: {BASE} | Worker: {WORKER}")
print("=" * 70)

# 0. INFRASTRUCTURE
print("\n[0] INFRASTRUCTURE")
test("RT-001", "Infra", "Web responds on :6015", f"{BASE}/", expect_contains="ESSEN Credentialing")
test("RT-002", "Infra", "CSS files loaded (Tailwind compiled)", f"{BASE}/", expect_contains="_next/static/css")
test("RT-003", "Infra", "JS bundles loaded", f"{BASE}/", expect_contains="_next/static/chunks")
test("RT-004", "Infra", "Hero: 'Credentialing made simple'", f"{BASE}/", expect_contains="Credentialing made")
test("RT-005", "Infra", "Nav: Sign In link", f"{BASE}/", expect_contains="/auth/signin")
test("RT-006", "Infra", "Nav: Register link", f"{BASE}/", expect_contains="/auth/register")
test("RT-007", "Infra", "Feature cards render", f"{BASE}/", expect_contains=["Document Upload", "Real-Time Status", "Automated Verification"])
test("RT-008", "Infra", "Footer with copyright", f"{BASE}/", expect_contains="Essen Medical Associates")
test("RT-009", "Infra", "Health: DB connected", f"{BASE}/api/health", expect_contains='"database":"ok"')
test("RT-010", "Infra", "Health: JSON structure", f"{BASE}/api/health", expect_json_key=["status", "timestamp", "services"])
test("RT-011", "Infra", "Bull Board accessible", f"{WORKER}/bull-board", expect_status=200)

# 1. AUTH PAGES
print("\n[1] AUTH PAGES")
test("RT-101", "Auth", "Signin page loads (200)", f"{BASE}/auth/signin")
test("RT-102", "Auth", "Signin has email field", f"{BASE}/auth/signin", expect_contains="ecred-email")
test("RT-103", "Auth", "Signin has password field", f"{BASE}/auth/signin", expect_contains="ecred-password")
test("RT-104", "Auth", "Signin has submit button", f"{BASE}/auth/signin", expect_contains="Sign in")
test("RT-105", "Auth", "Signin has Register link", f"{BASE}/auth/signin", expect_contains="/auth/register")
test("RT-106", "Auth", "Signin has Microsoft SSO button", f"{BASE}/auth/signin", expect_contains="Microsoft")
test("RT-107", "Auth", "Register page loads (200)", f"{BASE}/auth/register")
test("RT-108", "Auth", "Register has firstName field", f"{BASE}/auth/register", expect_contains="firstName")
test("RT-109", "Auth", "Register has lastName field", f"{BASE}/auth/register", expect_contains="lastName")
test("RT-110", "Auth", "Register has email field", f"{BASE}/auth/register", expect_contains='id="email"')
test("RT-111", "Auth", "Register has password field", f"{BASE}/auth/register", expect_contains='id="password"')
test("RT-112", "Auth", "Register has confirmPassword field", f"{BASE}/auth/register", expect_contains="confirmPassword")
test("RT-113", "Auth", "Register has submit button", f"{BASE}/auth/register", expect_contains="Create account")
test("RT-114", "Auth", "CSRF endpoint", f"{BASE}/api/auth/csrf", expect_json_key="csrfToken")
test("RT-115", "Auth", "Providers endpoint", f"{BASE}/api/auth/providers")
test("RT-116", "Auth", "Session endpoint (unauthed)", f"{BASE}/api/auth/session")

# 2. ROUTE PROTECTION (middleware redirects to signin page)
print("\n[2] ROUTE PROTECTION")
for tc_n, route, name in [
    (1, "/dashboard", "Dashboard"), (2, "/providers", "Providers"), (3, "/committee", "Committee"),
    (4, "/enrollments", "Enrollments"), (5, "/expirables", "Expirables"), (6, "/medicaid", "Medicaid"),
    (7, "/recredentialing", "Recredentialing"), (8, "/verifications", "Verifications"),
    (9, "/evaluations", "Evaluations"), (10, "/roster", "Roster"), (11, "/cme", "CME"),
    (12, "/telehealth", "Telehealth"), (13, "/reports", "Reports"), (14, "/compliance", "Compliance"),
    (15, "/scorecards", "Scorecards"), (16, "/analytics", "Analytics"), (17, "/admin", "Admin"),
]:
    test(f"RT-2{tc_n:02d}", "Auth", f"Unauthed {name} -> signin redirect", f"{BASE}{route}",
         expect_contains="auth/signin", pri="P0")

# 3. REST API (must return JSON, not HTML redirect)
print("\n[3] REST API AUTH")
test("RT-301", "API", "GET /api/v1/providers -> 401 JSON", f"{BASE}/api/v1/providers",
     expect_status=401, expect_json_key="error", pri="P0")
test("RT-302", "API", "GET /api/v1/enrollments -> 401 JSON", f"{BASE}/api/v1/enrollments",
     expect_status=401, expect_json_key="error", pri="P0")
test("RT-303", "API", "GET /api/v1/sanctions -> 401 JSON", f"{BASE}/api/v1/sanctions",
     expect_status=401, expect_json_key="error", pri="P0")
test("RT-304", "API", "FHIR /api/fhir/Practitioner -> 401 JSON", f"{BASE}/api/fhir/Practitioner",
     expect_status=401, pri="P0")
test("RT-305", "API", "GET /api/v1/providers/[id] -> 401 JSON", f"{BASE}/api/v1/providers/00000000-0000-0000-0000-000000000000",
     expect_status=401, pri="P0")
test("RT-306", "API", "API response is NOT HTML", f"{BASE}/api/v1/providers",
     expect_status=401, expect_not_contains="<!DOCTYPE html>", pri="P0")

# 4. PUBLIC ROUTES (should be accessible without auth)
print("\n[4] PUBLIC ROUTES")
test("RT-401", "Public", "/application accessible (no auth)", f"{BASE}/application")
test("RT-402", "Public", "/verify/work-history accessible", f"{BASE}/verify/work-history/test-token",
     expect_status=200, pri="P0")
test("RT-403", "Public", "/verify/reference accessible", f"{BASE}/verify/reference/test-token",
     expect_status=200, pri="P0")

# 5. REGISTER + LOGIN
print("\n[5] REGISTER & LOGIN")
email, pwd = register_test_user()
if email:
    test("RT-501", "Auth", "Registration endpoint works", f"{BASE}/api/auth/register",
         method="POST", body={"firstName":"QA2","lastName":"Test","email":f"qa2_{int(time.time())}@essen.com","password":"QATest123!"},
         expect_status=200, pri="P0")
    test("RT-502", "Auth", "Duplicate registration -> 409", f"{BASE}/api/auth/register",
         method="POST", body={"firstName":"QA","lastName":"Test","email":email,"password":"QATest123!"},
         expect_status=409, pri="P0")
    test("RT-503", "Auth", "Weak password rejected", f"{BASE}/api/auth/register",
         method="POST", body={"firstName":"QA","lastName":"Test","email":"weak@essen.com","password":"123"},
         expect_status=400, pri="P1")
    test("RT-504", "Auth", "Missing fields rejected", f"{BASE}/api/auth/register",
         method="POST", body={"email":"only@essen.com"},
         expect_status=400, pri="P1")

    logged_in = attempt_login(email, pwd)
    if logged_in:
        # 6. AUTHENTICATED PAGES
        print("\n[6] AUTHENTICATED PAGES")
        pages = [
            (1, "/dashboard", "Dashboard", "Dashboard"),
            (2, "/providers", "Providers", "Provider"),
            (3, "/committee", "Committee", "Committee"),
            (4, "/enrollments", "Enrollments", "Enrollment"),
            (5, "/expirables", "Expirables", "Expir"),
            (6, "/medicaid", "NY Medicaid", "Medicaid"),
            (7, "/recredentialing", "Recredentialing", "Recredentialing"),
            (8, "/verifications", "Verifications", "Verif"),
            (9, "/evaluations", "Evaluations", "valuation"),
            (10, "/roster", "Roster", "Roster"),
            (11, "/cme", "CME", "CME"),
            (12, "/telehealth", "Telehealth", "Telehealth"),
            (13, "/reports", "Reports", "Report"),
            (14, "/compliance", "Compliance", "Compliance"),
            (15, "/scorecards", "Scorecards", "Scorecard"),
            (16, "/analytics", "Analytics", "Analytic"),
        ]
        for n, route, name, kw in pages:
            test(f"RT-6{n:02d}", "Pages", f"{name} page renders with content", f"{BASE}{route}",
                 expect_contains=kw, pri="P0")

        # Admin pages (new user is SPECIALIST, should redirect)
        print("\n[7] RBAC - SPECIALIST RESTRICTIONS")
        test("RT-701", "RBAC", "SPECIALIST -> /admin redirects to dashboard", f"{BASE}/admin",
             expect_not_contains="Admin Dashboard", pri="P0")

        # 8. tRPC endpoints
        print("\n[8] tRPC ENDPOINTS")
        test("RT-801", "tRPC", "provider.list responds", 
             f"{BASE}/api/trpc/provider.list?input=" + urllib.parse.quote('{"json":{"page":1,"limit":5}}'),
             expect_status=200, pri="P0")
        test("RT-802", "tRPC", "committee.listSessions responds",
             f"{BASE}/api/trpc/committee.listSessions?input=" + urllib.parse.quote('{"json":{}}'),
             expect_status=200, pri="P0")
        test("RT-803", "tRPC", "expirable.getSummary responds",
             f"{BASE}/api/trpc/expirable.getSummary?input=" + urllib.parse.quote('{"json":{}}'),
             expect_status=200, pri="P0")
        test("RT-804", "tRPC", "report.complianceSummary responds",
             f"{BASE}/api/trpc/report.complianceSummary?input=" + urllib.parse.quote('{"json":{}}'),
             expect_status=200, pri="P1")
        test("RT-805", "tRPC", "admin.getStats responds",
             f"{BASE}/api/trpc/admin.getStats?input=" + urllib.parse.quote('{"json":{}}'),
             pri="P1")
    else:
        print("\n  [BLOCKED] Login failed - skipping authenticated tests")
        for i in range(1,20):
            results.append({"tc":f"RT-6{i:02d}","mod":"Pages","desc":"BLOCKED: no session",
                            "url":"","method":"GET","pri":"P0","result":"BLOCKED",
                            "status":0,"size":0,"ms":0,"detail":"Could not login"})
else:
    print("  [BLOCKED] Registration failed - skipping auth tests")

# 9. WEBHOOK
print("\n[9] WEBHOOKS & MISC")
test("RT-901", "Webhook", "SendGrid webhook endpoint exists", f"{BASE}/api/webhooks/sendgrid",
     method="POST", body=[], expect_status=200, pri="P2")

# ================================================================
print("\n" + "=" * 70)
print("RUNTIME TEST SUMMARY")
print("=" * 70)
total = len(results)
passed = sum(1 for r in results if r["result"]=="PASS")
failed = sum(1 for r in results if r["result"]=="FAIL")
blocked = sum(1 for r in results if r["result"]=="BLOCKED")
print(f"TOTAL:   {total}")
print(f"PASSED:  {passed} ({round(passed/max(total,1)*100)}%)")
print(f"FAILED:  {failed} ({round(failed/max(total,1)*100)}%)")
print(f"BLOCKED: {blocked}")
if total-blocked > 0:
    print(f"Pass Rate (excl blocked): {round(passed/max(total-blocked,1)*100,1)}%")

if failed:
    print(f"\n--- FAILURES ---")
    for r in results:
        if r["result"]=="FAIL":
            print(f"  {r['tc']}: {r['desc']}")
            print(f"         {r['detail']}")

now = datetime.now().strftime("%Y%m%d_%H%M%S")
path = f"c:\\Users\\admin\\development\\HDPulseAI\\EssenApps\\E_Credentialing\\docs\\testing\\runtime_results_{now}.json"
with open(path, "w") as f:
    json.dump({"time": datetime.now().isoformat(), "target": BASE,
               "summary": {"total":total,"passed":passed,"failed":failed,"blocked":blocked},
               "results": results}, f, indent=2)
print(f"\nSaved: {path}")
