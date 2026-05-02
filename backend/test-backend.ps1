# ============================================================
# SMART TOLL GATE - BACKEND API TEST SCRIPT
# ============================================================

param(
    [int]$RunNumber = 1
)

$BaseUrl = "http://localhost:5000/api/v1"
$TestsPassed = 0
$TestsFailed = 0
$TestResults = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [scriptblock]$Validation = { $true }
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
        }
        if ($Body) { $params.Body = $Body }
        
        $response = Invoke-RestMethod @params
        $valid = & $Validation $response
        
        if ($valid) {
            $script:TestsPassed++
            $script:TestResults += @{ Name = $Name; Status = "PASS"; Response = $response }
            Write-Host "  [PASS] $Name" -ForegroundColor Green
            return $response
        } else {
            $script:TestsFailed++
            $script:TestResults += @{ Name = $Name; Status = "FAIL"; Error = "Validation failed" }
            Write-Host "  [FAIL] $Name - Validation failed" -ForegroundColor Red
            return $null
        }
    } catch {
        $script:TestsFailed++
        $errorMsg = $_.Exception.Message
        $script:TestResults += @{ Name = $Name; Status = "FAIL"; Error = $errorMsg }
        Write-Host "  [FAIL] $Name - $errorMsg" -ForegroundColor Red
        return $null
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  SMART TOLL GATE - BACKEND TEST RUN #$RunNumber" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ============================================================
# 1. HEALTH CHECK
# ============================================================
Write-Host "`n[1] HEALTH CHECK" -ForegroundColor Yellow
Test-Endpoint -Name "Health Check" -Method GET -Url "$BaseUrl/health" -Validation { param($r) $r.success -eq $true }

# ============================================================
# 2. AUTHENTICATION
# ============================================================
Write-Host "`n[2] AUTHENTICATION" -ForegroundColor Yellow

$managerLogin = Test-Endpoint -Name "Login Manager" -Method POST -Url "$BaseUrl/auth/login" `
    -Body '{"username":"manager_thinh","password":"password123"}' `
    -Validation { param($r) $r.success -and $r.data.role -eq "manager" }
$managerToken = if ($managerLogin) { $managerLogin.data.access_token } else { "" }

$guardLogin = Test-Endpoint -Name "Login Guard" -Method POST -Url "$BaseUrl/auth/login" `
    -Body '{"username":"guard_nam","password":"password123"}' `
    -Validation { param($r) $r.success -and $r.data.role -eq "guard" }
$guardToken = if ($guardLogin) { $guardLogin.data.access_token } else { "" }

$citizenLogin = Test-Endpoint -Name "Login Citizen" -Method POST -Url "$BaseUrl/auth/login" `
    -Body '{"username":"citizen_hoa","password":"password123"}' `
    -Validation { param($r) $r.success -and $r.data.role -eq "citizen" }
$citizenToken = if ($citizenLogin) { $citizenLogin.data.access_token } else { "" }

# Test invalid login
try {
    Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body '{"username":"invalid","password":"wrong"}'
    $TestsFailed++
    Write-Host "  [FAIL] Invalid Login Should Fail" -ForegroundColor Red
} catch {
    $TestsPassed++
    Write-Host "  [PASS] Invalid Login Rejected" -ForegroundColor Green
}

# Get Me endpoints
$mh = @{Authorization = "Bearer $managerToken"}
$gh = @{Authorization = "Bearer $guardToken"}
$ch = @{Authorization = "Bearer $citizenToken"}

Test-Endpoint -Name "Get Me (Manager)" -Method GET -Url "$BaseUrl/auth/me" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.role -eq "manager" }

Test-Endpoint -Name "Get Me (Guard)" -Method GET -Url "$BaseUrl/auth/me" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data.guard_details -ne $null }

Test-Endpoint -Name "Get Me (Citizen)" -Method GET -Url "$BaseUrl/auth/me" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data.citizen_details -ne $null }

# ============================================================
# 3. CITIZENS MODULE
# ============================================================
Write-Host "`n[3] CITIZENS MODULE" -ForegroundColor Yellow

# OTP (endpoint is /tokens)
$otp = Test-Endpoint -Name "Create OTP" -Method POST -Url "$BaseUrl/citizens/tokens" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data.otp_code.Length -eq 6 }
$otpCode = if ($otp) { $otp.data.otp_code } else { "000000" }

Test-Endpoint -Name "Get Active OTP" -Method GET -Url "$BaseUrl/citizens/tokens" -Headers $ch `
    -Validation { param($r) $r.success }

# Vehicles
Test-Endpoint -Name "Get My Vehicles" -Method GET -Url "$BaseUrl/citizens/vehicles" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data -is [array] }

$rnd = Get-Random -Minimum 10000 -Maximum 99999
$plate = "59A-$rnd"
$plate2 = "60A-$rnd"

$newVehicle = Test-Endpoint -Name "Register Vehicle" -Method POST -Url "$BaseUrl/citizens/vehicles" -Headers $ch `
    -Body "{`"vehicle_type`":`"motorbike`", `"license_plate`":`"$plate`", `"vehicle_color`":`"red`"}" `
    -Validation { param($r) $r.success -and $r.data.vehicle_id -ne $null }

if ($newVehicle) {
    $vId = $newVehicle.data.vehicle_id
    
    Test-Endpoint -Name "Edit Vehicle" -Method PUT -Url "$BaseUrl/citizens/vehicles/$vId" -Headers $ch `
        -Body "{`"vehicle_type`":`"motorbike`", `"license_plate`":`"$plate2`", `"vehicle_color`":`"blue`"}" `
        -Validation { param($r) $r.success -and $r.data.license_plate -eq $plate2 }
        
    Test-Endpoint -Name "Delete Vehicle" -Method DELETE -Url "$BaseUrl/citizens/vehicles/$vId" -Headers $ch `
        -Validation { param($r) $r.success }
}

# Vehicle Types
Test-Endpoint -Name "Get Vehicle Types" -Method GET -Url "$BaseUrl/citizens/vehicle-types" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data -is [array] }

# Guests
Test-Endpoint -Name "Get My Guests" -Method GET -Url "$BaseUrl/citizens/guests" -Headers $ch `
    -Validation { param($r) $r.success }

# ============================================================
# 4. GUARDS MODULE
# ============================================================
Write-Host "`n[4] GUARDS MODULE" -ForegroundColor Yellow

# Verify OTP (requires gate_id, guard_id, otp_code)
$verifyResult = Test-Endpoint -Name "Verify OTP" -Method POST -Url "$BaseUrl/guards/verify-otp" -Headers $gh `
    -Body "{`"otp_code`":`"$otpCode`",`"gate_id`":1,`"guard_id`":2}" `
    -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }

# If OTP validation failed, try creating a new one and verify again
if (-not $verifyResult) {
    Write-Host "  [INFO] Creating fresh OTP for retry..." -ForegroundColor Cyan
    $newOtp = Invoke-RestMethod -Uri "$BaseUrl/citizens/tokens" -Method POST -Headers $ch -ContentType "application/json" 2>$null
    if ($newOtp -and $newOtp.success) {
        $freshOtpCode = $newOtp.data.otp_code
        $retryResult = Test-Endpoint -Name "Verify OTP (Retry)" -Method POST -Url "$BaseUrl/guards/verify-otp" -Headers $gh `
            -Body "{`"otp_code`":`"$freshOtpCode`",`"gate_id`":1,`"guard_id`":2}" `
            -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }
    }
}

# Manual Action - Open
Test-Endpoint -Name "Manual Action (Open)" -Method POST -Url "$BaseUrl/guards/manual-action" -Headers $gh `
    -Body '{"gate_id":1,"guard_id":2,"action_type":"open_barrier","note":"Test shipper delivery"}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }

# Manual Action - Keep Closed
Test-Endpoint -Name "Manual Action (Keep Closed)" -Method POST -Url "$BaseUrl/guards/manual-action" -Headers $gh `
    -Body '{"gate_id":1,"guard_id":2,"action_type":"keep_closed_log_only","note":"Test suspicious vehicle"}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "KEEP_CLOSED" }

# Logs
Test-Endpoint -Name "Get Recent Logs" -Method GET -Url "$BaseUrl/guards/logs?gate_id=1&limit=5" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

# Stats
Test-Endpoint -Name "Get Gate Stats" -Method GET -Url "$BaseUrl/guards/stats?gate_id=1" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data.last_24h -ge 0 }

# Action Reasons
Test-Endpoint -Name "Get Action Reasons" -Method GET -Url "$BaseUrl/guards/action-reasons" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data.action_types.Count -gt 0 }

# ============================================================
# 5. GATES MODULE (AI Check-in)
# ============================================================
Write-Host "`n[5] GATES MODULE" -ForegroundColor Yellow

# Valid plate (resident)
Test-Endpoint -Name "AI Check-in (Resident)" -Method POST -Url "$BaseUrl/gates/check-in" `
    -Body '{"gate_id":1,"plate_text":"59A1-12345","confidence_score":0.95,"model_id":1,"processing_time_ms":100}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }

# Unknown plate
Test-Endpoint -Name "AI Check-in (Unknown)" -Method POST -Url "$BaseUrl/gates/check-in" `
    -Body '{"gate_id":1,"plate_text":"99X9-99999","confidence_score":0.90,"model_id":1,"processing_time_ms":100}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "KEEP_CLOSED" }

# ============================================================
# 6. MANAGERS MODULE
# ============================================================
Write-Host "`n[6] MANAGERS MODULE" -ForegroundColor Yellow

# Analytics
Test-Endpoint -Name "Analytics Overview" -Method GET -Url "$BaseUrl/managers/analytics/overview" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.zone_name -ne $null }

Test-Endpoint -Name "Traffic by Day" -Method GET -Url "$BaseUrl/managers/analytics/traffic-by-day?days=7" -Headers $mh `
    -Validation { param($r) $r.success }

Test-Endpoint -Name "Traffic by Hour" -Method GET -Url "$BaseUrl/managers/analytics/traffic-by-hour" -Headers $mh `
    -Validation { param($r) $r.success }

Test-Endpoint -Name "Vehicle Types" -Method GET -Url "$BaseUrl/managers/analytics/vehicle-types" -Headers $mh `
    -Validation { param($r) $r.success }

Test-Endpoint -Name "Access Methods" -Method GET -Url "$BaseUrl/managers/analytics/access-methods" -Headers $mh `
    -Validation { param($r) $r.success }

# Logs
Test-Endpoint -Name "Search Logs" -Method GET -Url "$BaseUrl/managers/logs?limit=5" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.pagination -ne $null }

Test-Endpoint -Name "Log Detail" -Method GET -Url "$BaseUrl/managers/logs/1" -Headers $mh `
    -Validation { param($r) $r.success -or $_.Exception.Message -match "404" }

Test-Endpoint -Name "Audit Logs" -Method GET -Url "$BaseUrl/managers/audit-logs" -Headers $mh `
    -Validation { param($r) $r.success }

# Gates
Test-Endpoint -Name "Gates in Zone" -Method GET -Url "$BaseUrl/managers/gates" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

# Pending vehicles
Test-Endpoint -Name "Pending Vehicles" -Method GET -Url "$BaseUrl/managers/vehicles/pending" -Headers $mh `
    -Validation { param($r) $r.success }

# AI
Test-Endpoint -Name "AI Performance" -Method GET -Url "$BaseUrl/managers/ai/performance" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.stats -ne $null }

Test-Endpoint -Name "AI Models" -Method GET -Url "$BaseUrl/managers/ai/models" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

Test-Endpoint -Name "AI Corrections" -Method GET -Url "$BaseUrl/managers/ai/corrections" -Headers $mh `
    -Validation { param($r) $r.success }

# ============================================================
# 7. AUTHORIZATION TESTS
# ============================================================
Write-Host "`n[7] AUTHORIZATION TESTS" -ForegroundColor Yellow

# Citizen cannot access guard endpoints
try {
    Invoke-RestMethod -Uri "$BaseUrl/guards/logs?gate_id=1" -Method GET -Headers $ch
    $TestsFailed++
    Write-Host "  [FAIL] Citizen Should Not Access Guard Endpoint" -ForegroundColor Red
} catch {
    $TestsPassed++
    Write-Host "  [PASS] Citizen Blocked from Guard Endpoint" -ForegroundColor Green
}

# Guard cannot access manager endpoints
try {
    Invoke-RestMethod -Uri "$BaseUrl/managers/analytics/overview" -Method GET -Headers $gh
    $TestsFailed++
    Write-Host "  [FAIL] Guard Should Not Access Manager Endpoint" -ForegroundColor Red
} catch {
    $TestsPassed++
    Write-Host "  [PASS] Guard Blocked from Manager Endpoint" -ForegroundColor Green
}

# No token should fail
try {
    Invoke-RestMethod -Uri "$BaseUrl/auth/me" -Method GET
    $TestsFailed++
    Write-Host "  [FAIL] No Token Should Fail" -ForegroundColor Red
} catch {
    $TestsPassed++
    Write-Host "  [PASS] No Token Rejected" -ForegroundColor Green
}

# ============================================================
# SUMMARY
# ============================================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  TEST RUN #$RunNumber SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Total Tests: $($TestsPassed + $TestsFailed)" -ForegroundColor White
Write-Host "  Passed: $TestsPassed" -ForegroundColor Green
Write-Host "  Failed: $TestsFailed" -ForegroundColor $(if ($TestsFailed -gt 0) { "Red" } else { "Green" })
Write-Host "  Success Rate: $([math]::Round($TestsPassed / ($TestsPassed + $TestsFailed) * 100, 1))%" -ForegroundColor $(if ($TestsFailed -gt 0) { "Yellow" } else { "Green" })
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

return @{
    Run = $RunNumber
    Passed = $TestsPassed
    Failed = $TestsFailed
    Total = $TestsPassed + $TestsFailed
    SuccessRate = [math]::Round($TestsPassed / ($TestsPassed + $TestsFailed) * 100, 1)
}
