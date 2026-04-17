$routes = @("/", "/dashboard", "/providers", "/admin/users", "/committee", "/verifications", "/compliance", "/analytics", "/reports")
foreach ($r in $routes) {
  $t = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:6015$r" -MaximumRedirection 0 -TimeoutSec 30 -ErrorAction SilentlyContinue
    $code = $resp.StatusCode
  } catch {
    $code = $_.Exception.Response.StatusCode.Value__
  }
  $t.Stop()
  "{0,6}ms  {1,3}  {2}" -f $t.ElapsedMilliseconds, $code, $r
}
