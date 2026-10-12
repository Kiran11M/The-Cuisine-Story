# The Cuisine Story - local order server (no install needed, runs on Windows PowerShell 5.1+).
# Serves the website and the table-ordering API. Phones on the same WiFi can scan the table QR codes.
# Start it with start-server.bat. Orders are saved in data\tickets.json.
param(
  [int]$Port = 8080,
  [string]$StaffPin = "1234"   # PIN for the kitchen/waiter screen (kitchen.html). Change this!
)

$ErrorActionPreference = "Stop"
$Root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$DataDir = Join-Path $Root "data"
$DataFile = Join-Path $DataDir "tickets.json"
$Utf8 = New-Object Text.UTF8Encoding $false
New-Item -ItemType Directory -Force $DataDir | Out-Null

$OrderStatuses = @("new", "preparing", "ready", "served", "cancelled")
$CallStatuses = @("new", "done")
$MaxBodyBytes = 64KB

function Now-Ms { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
function StartOfToday-Ms { ([DateTimeOffset](Get-Date).Date).ToUnixTimeMilliseconds() }

# ---------- Storage ----------
$script:Tickets = New-Object System.Collections.ArrayList
if (Test-Path $DataFile) {
  $raw = [IO.File]::ReadAllText($DataFile, $Utf8)
  if ($raw.Trim()) {
    $keepFrom = (StartOfToday-Ms) - 2 * 86400000   # keep the last 2 days
    $parsed = ConvertFrom-Json $raw   # PS 5.1: assign first so the array gets enumerated
    foreach ($t in $parsed) {
      if ($t.createdAt -ge $keepFrom) { [void]$script:Tickets.Add($t) }
    }
  }
}
function Save-Tickets {
  $json = ConvertTo-Json -InputObject @($script:Tickets) -Depth 6
  $tmp = "$DataFile.tmp"
  [IO.File]::WriteAllText($tmp, $json, $Utf8)
  Move-Item -Force $tmp $DataFile
}

# ---------- Helpers ----------
function Bad([string]$msg) { throw [ArgumentException]::new($msg) }

function Clean($value, [int]$max) {
  if ($null -eq $value) { return "" }
  $s = ([string]$value).Trim() -replace "[\x00-\x08\x0B\x0C\x0E-\x1F]", ""
  if ($s.Length -gt $max) { $s = $s.Substring(0, $max) }
  return $s
}

function New-Id {
  $chars = "abcdefghjkmnpqrstuvwxyz23456789".ToCharArray()
  $bytes = New-Object byte[] 10
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Send($ctx, [int]$status, [byte[]]$bytes, [string]$type) {
  $res = $ctx.Response
  $res.StatusCode = $status
  $res.ContentType = $type
  $res.Headers["Cache-Control"] = "no-store"
  $res.Headers["X-Content-Type-Options"] = "nosniff"
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

function Send-Json($ctx, [int]$status, $obj) {
  $json = ConvertTo-Json -InputObject $obj -Depth 6 -Compress
  Send $ctx $status $Utf8.GetBytes($json) "application/json; charset=utf-8"
}

function Read-Body($req) {
  if ($req.ContentLength64 -gt $MaxBodyBytes) { Bad "Request too large" }
  $reader = New-Object IO.StreamReader($req.InputStream, $Utf8)
  $text = $reader.ReadToEnd()
  $reader.Close()
  if ($text.Length -gt $MaxBodyBytes) { Bad "Request too large" }
  try { return $text | ConvertFrom-Json } catch { Bad "Invalid JSON" }
}

function Find-Ticket([string]$id) {
  foreach ($t in $script:Tickets) { if ($t.id -eq $id) { return $t } }
  return $null
}

function Require-Pin($req) {
  return ($req.Headers["X-Staff-Pin"] -eq $StaffPin)
}

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"; ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".png" = "image/png"
  ".webp" = "image/webp"; ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"; ".txt" = "text/plain; charset=utf-8"
}

# ---------- API ----------
function Create-Ticket($body) {
  $type = Clean $body.type 10
  if ($type -notin @("order", "waiter", "bill")) { Bad "Unknown request type" }
  $table = Clean $body.table 10
  if (-not $table) { Bad "Table number is required" }

  $items = @()
  $total = 0
  if ($type -eq "order") {
    $rawItems = @($body.items)
    if ($rawItems.Count -lt 1 -or $rawItems.Count -gt 60) { Bad "Order must have 1 to 60 items" }
    foreach ($it in $rawItems) {
      $qty = 0; $price = 0.0
      if (-not [int]::TryParse([string]$it.qty, [ref]$qty) -or $qty -lt 1 -or $qty -gt 50) { Bad "Invalid quantity" }
      if (-not [double]::TryParse([string]$it.price, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$price) -or $price -lt 0 -or $price -gt 100000) { Bad "Invalid price" }
      $name = Clean $it.name 80
      if (-not $name) { Bad "Item name missing" }
      $items += [pscustomobject]@{ id = (Clean $it.id 60); name = $name; price = $price; qty = $qty; veg = [bool]$it.veg }
      $total += $price * $qty
    }
  }

  $now = Now-Ms
  $ticket = [pscustomobject]@{
    id = New-Id; type = $type; table = $table
    name = (Clean $body.name 40); note = (Clean $body.note 300)
    items = $items; total = $total; status = "new"; createdAt = $now; updatedAt = $now
  }
  [void]$script:Tickets.Add($ticket)
  Save-Tickets
  $label = if ($type -eq "order") { "ORDER  ($($items.Count) items, Rs $total)" } elseif ($type -eq "bill") { "BILL REQUEST" } else { "WAITER CALL" }
  Write-Host ("[{0}] Table {1}: {2}" -f (Get-Date -Format "HH:mm:ss"), $table, $label) -ForegroundColor Yellow
  return $ticket
}

function Handle-Api($ctx, [string]$path) {
  $req = $ctx.Request
  $method = $req.HttpMethod

  if ($path -eq "/api/info" -and $method -eq "GET") {
    Send-Json $ctx 200 @{ lanUrls = @($script:LanUrls) }
    return
  }
  if ($path -eq "/api/tickets") {
    if ($method -eq "POST") {
      $ticket = Create-Ticket (Read-Body $req)
      Send-Json $ctx 201 @{ id = $ticket.id }
      return
    }
    if ($method -eq "GET") {
      if (-not (Require-Pin $req)) { Send-Json $ctx 401 @{ error = "Wrong PIN" }; return }
      $from = StartOfToday-Ms
      $list = @($script:Tickets | Where-Object { $_.createdAt -ge $from })
      Send-Json $ctx 200 $list
      return
    }
  }
  elseif ($path -match "^/api/tickets/([a-z0-9]{6,20})$") {
    $ticket = Find-Ticket $Matches[1]
    if (-not $ticket) { Send-Json $ctx 404 @{ error = "Not found" }; return }
    if ($method -eq "GET") { Send-Json $ctx 200 $ticket; return }
    if ($method -eq "PATCH") {
      if (-not (Require-Pin $req)) { Send-Json $ctx 401 @{ error = "Wrong PIN" }; return }
      $body = Read-Body $req
      $status = Clean $body.status 20
      $allowed = if ($ticket.type -eq "order") { $OrderStatuses } else { $CallStatuses }
      if ($status -notin $allowed) { Bad "Invalid status" }
      $ticket.status = $status
      $ticket.updatedAt = Now-Ms
      Save-Tickets
      Send-Json $ctx 200 $ticket
      return
    }
  }
  Send-Json $ctx 404 @{ error = "Not found" }
}

# ---------- Static files ----------
function Handle-Static($ctx, [string]$path) {
  if ($ctx.Request.HttpMethod -notin @("GET", "HEAD")) { Send-Json $ctx 405 @{ error = "Method not allowed" }; return }
  if ($path -eq "/") { $path = "/index.html" }
  $rel = [Uri]::UnescapeDataString($path.TrimStart("/")) -replace "/", "\"
  $full = [IO.Path]::GetFullPath((Join-Path $Root $rel))
  $ext = [IO.Path]::GetExtension($full).ToLower()
  $blocked = (-not $full.StartsWith($Root + "\", [StringComparison]::OrdinalIgnoreCase)) -or
             $full.StartsWith($DataDir, [StringComparison]::OrdinalIgnoreCase) -or
             (-not $MimeTypes.ContainsKey($ext))
  if ($blocked -or -not (Test-Path -LiteralPath $full -PathType Leaf)) {
    Send $ctx 404 $Utf8.GetBytes("Not found") "text/plain; charset=utf-8"
    return
  }
  Send $ctx 200 ([IO.File]::ReadAllBytes($full)) $MimeTypes[$ext]
}

# ---------- Start ----------
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://+:$Port/")
$lanEnabled = $true
try { $listener.Start() }
catch {
  $lanEnabled = $false
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Start()
}

Write-Host ""
Write-Host "  The Cuisine Story - order server is running" -ForegroundColor Green
Write-Host "  ------------------------------------------"
Write-Host "  On this computer:   http://localhost:$Port/"
$script:LanUrls = @()
if ($lanEnabled) {
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" } | Select-Object -ExpandProperty IPAddress
  foreach ($ip in $ips) {
    $script:LanUrls += "http://${ip}:$Port/"
    Write-Host "  On phones (WiFi):   http://${ip}:$Port/" -ForegroundColor Cyan
  }
} else {
  Write-Host "  Phones can NOT connect yet. Close this window, right-click start-server.bat" -ForegroundColor Red
  Write-Host "  and choose 'Run as administrator' once to allow WiFi access." -ForegroundColor Red
}
Write-Host "  Kitchen screen:     http://localhost:$Port/kitchen.html   (PIN: $StaffPin)"
Write-Host "  Table QR codes:     http://localhost:$Port/qr.html"
Write-Host "  Press Ctrl+C to stop."
Write-Host ""

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(500)) { }   # short waits let Ctrl+C stop the server
    $ctx = $task.Result
    try {
      $path = $ctx.Request.Url.AbsolutePath
      if ($path.StartsWith("/api/")) { Handle-Api $ctx $path } else { Handle-Static $ctx $path }
    }
    catch [ArgumentException] {
      try { Send-Json $ctx 400 @{ error = $_.Exception.Message } } catch { }
    }
    catch {
      Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
      try { Send-Json $ctx 500 @{ error = "Server error" } } catch { }
    }
    finally {
      try { $ctx.Response.Close() } catch { }
    }
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
