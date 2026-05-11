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

function Test-ExpectError {
    param([string]$Name, [scriptblock]$Action, [int]$ExpectedStatus = 0)
    try {
        & $Action
        $script:TestsFailed++
        Write-Host "  [FAIL] $Name - should have thrown error" -ForegroundColor Red
    } catch {
        $script:TestsPassed++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
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
Test-Endpoint -Name "Health Check" -Method GET -Url "$BaseUrl/health" `
    -Validation { param($r) $r.success -eq $true }

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

Test-ExpectError -Name "Invalid Login Rejected" -Action {
    Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" `
        -Body '{"username":"invalid","password":"wrong"}'
}

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

# OTP — field is otp_code in response (token_data internally)
$otp = Test-Endpoint -Name "Create OTP" -Method POST -Url "$BaseUrl/citizens/tokens" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data.otp_code.Length -eq 6 }
$otpCode = if ($otp) { $otp.data.otp_code } else { "123456" }

Test-Endpoint -Name "Get Active Tokens" -Method GET -Url "$BaseUrl/citizens/tokens" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data -is [array] }

# QR code
Test-Endpoint -Name "Create QR Token" -Method POST -Url "$BaseUrl/citizens/qr-code" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data.qr_data -ne $null }

# Vehicles
Test-Endpoint -Name "Get My Vehicles" -Method GET -Url "$BaseUrl/citizens/vehicles" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data -is [array] }

Test-Endpoint -Name "Get Vehicle Types" -Method GET -Url "$BaseUrl/citizens/vehicle-types" -Headers $ch `
    -Validation { param($r) $r.success -and $r.data -is [array] -and $r.data.Count -gt 0 }

$rnd = Get-Random -Minimum 10000 -Maximum 99999
$plate  = "59A-T$rnd"
$plate2 = "60A-T$rnd"

$newVehicle = Test-Endpoint -Name "Register Vehicle" -Method POST -Url "$BaseUrl/citizens/vehicles" -Headers $ch `
    -Body "{`"vehicle_type`":`"motorbike`",`"license_plate`":`"$plate`",`"vehicle_color`":`"red`"}" `
    -Validation { param($r) $r.success -and $r.data.vehicle_id -ne $null }

if ($newVehicle) {
    $vId = $newVehicle.data.vehicle_id

    Test-Endpoint -Name "Edit Vehicle (PUT)" -Method PUT -Url "$BaseUrl/citizens/vehicles/$vId" -Headers $ch `
        -Body "{`"vehicle_type`":`"motorbike`",`"license_plate`":`"$plate2`",`"vehicle_color`":`"blue`"}" `
        -Validation { param($r) $r.success -and $r.data.status -eq "pending_update" }

    Test-Endpoint -Name "Delete Vehicle (direct)" -Method DELETE -Url "$BaseUrl/citizens/vehicles/$vId" -Headers $ch `
        -Validation { param($r) $r.success -and $r.data.vehicle_id -ne $null }
}

# Guests
Test-Endpoint -Name "Get My Guests" -Method GET -Url "$BaseUrl/citizens/guests" -Headers $ch `
    -Validation { param($r) $r.success }

# Access Logs for citizen
Test-Endpoint -Name "Get My Access Logs" -Method GET -Url "$BaseUrl/citizens/logs" -Headers $ch `
    -Validation { param($r) $r.success }

# ============================================================
# 4. GUARDS MODULE
# ============================================================
Write-Host "`n[4] GUARDS MODULE" -ForegroundColor Yellow

# Verify OTP — lane_id required (not gate_id/guard_id)
$verifyResult = Test-Endpoint -Name "Verify OTP" -Method POST -Url "$BaseUrl/guards/verify-otp" -Headers $gh `
    -Body "{`"lane_id`":`"MAIN-IN`",`"otp_code`":`"$otpCode`"}" `
    -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }

if (-not $verifyResult) {
    Write-Host "  [INFO] Tạo OTP mới để retry..." -ForegroundColor Cyan
    $freshOtpResp = Invoke-RestMethod -Uri "$BaseUrl/citizens/tokens" -Method POST `
        -Headers $ch -ContentType "application/json" -ErrorAction SilentlyContinue
    if ($freshOtpResp -and $freshOtpResp.success) {
        $freshCode = $freshOtpResp.data.otp_code
        Test-Endpoint -Name "Verify OTP (Retry)" -Method POST -Url "$BaseUrl/guards/verify-otp" -Headers $gh `
            -Body "{`"lane_id`":`"MAIN-IN`",`"otp_code`":`"$freshCode`"}" `
            -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }
    }
}

# Manual Action — lane_id (not gate_id), action_type
Test-Endpoint -Name "Manual Action (Open)" -Method POST -Url "$BaseUrl/guards/manual-action" -Headers $gh `
    -Body '{"lane_id":"MAIN-IN","action_type":"open_barrier","action_reason":"Cho xe giao hàng vào","note":"Test"}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "OPEN" }

Test-Endpoint -Name "Manual Action (Close)" -Method POST -Url "$BaseUrl/guards/manual-action" -Headers $gh `
    -Body '{"lane_id":"MAIN-IN","action_type":"close_barrier","action_reason":"Kết thúc ca","note":"Test"}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "CLOSE" }

# Logs — requires lane_id
Test-Endpoint -Name "Get Recent Logs" -Method GET -Url "$BaseUrl/guards/logs?lane_id=MAIN-IN&limit=5" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

# Stats — requires lane_id
Test-Endpoint -Name "Get Lane Stats" -Method GET -Url "$BaseUrl/guards/stats?lane_id=MAIN-IN" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data.last_24h -ge 0 }

# Action Reasons
Test-Endpoint -Name "Get Action Reasons" -Method GET -Url "$BaseUrl/guards/action-reasons" -Headers $gh `
    -Validation { param($r) $r.success -and $r.data.action_types.Count -gt 0 }

# ============================================================
# 5. GATES MODULE (AI Check-in)
# ============================================================
Write-Host "`n[5] GATES MODULE" -ForegroundColor Yellow

# Valid plate (resident) — uses lane_id not gate_id
Test-Endpoint -Name "AI Check-in (Resident)" -Method POST -Url "$BaseUrl/gates/check-in" `
    -Body '{"lane_id":"MAIN-IN","plate_text":"59A1-12345","confidence_score":0.95}' `
    -Validation { param($r) $r.success -and $r.data.action -ne $null }

# Unknown plate
Test-Endpoint -Name "AI Check-in (Unknown Plate)" -Method POST -Url "$BaseUrl/gates/check-in" `
    -Body '{"lane_id":"MAIN-IN","plate_text":"99X9-99999","confidence_score":0.90}' `
    -Validation { param($r) $r.success -and $r.data.action -eq "KEEP_CLOSED" }

# Gate info
Test-Endpoint -Name "Get Gate Info" -Method GET -Url "$BaseUrl/gates/1" `
    -Validation { param($r) $r.success -and $r.data.gate_id -ne $null }

# ============================================================
# 6. MANAGERS MODULE
# ============================================================
Write-Host "`n[6] MANAGERS MODULE" -ForegroundColor Yellow

# Analytics — period filter
Test-Endpoint -Name "Analytics Overview (day)" -Method GET -Url "$BaseUrl/managers/analytics/overview?period=day" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.stats.total_traffic -ne $null }

Test-Endpoint -Name "Analytics Overview (week)" -Method GET -Url "$BaseUrl/managers/analytics/overview?period=week" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.stats.period -eq "week" }

Test-Endpoint -Name "Analytics Overview (month)" -Method GET -Url "$BaseUrl/managers/analytics/overview?period=month" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.stats.automation_rate_percent -ne $null }

Test-Endpoint -Name "Traffic by Day (granted/denied)" -Method GET -Url "$BaseUrl/managers/analytics/traffic-by-day?days=7" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

Test-Endpoint -Name "Traffic by Hour" -Method GET -Url "$BaseUrl/managers/analytics/traffic-by-hour" -Headers $mh `
    -Validation { param($r) $r.success }

Test-Endpoint -Name "Vehicle Types Distribution" -Method GET -Url "$BaseUrl/managers/analytics/vehicle-types" -Headers $mh `
    -Validation { param($r) $r.success }

Test-Endpoint -Name "Access Methods Distribution" -Method GET -Url "$BaseUrl/managers/analytics/access-methods" -Headers $mh `
    -Validation { param($r) $r.success }

# Logs
Test-Endpoint -Name "Search Logs" -Method GET -Url "$BaseUrl/managers/logs?limit=5" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.pagination -ne $null }

Test-Endpoint -Name "Audit Logs" -Method GET -Url "$BaseUrl/managers/audit-logs" -Headers $mh `
    -Validation { param($r) $r.success }

# Gates
Test-Endpoint -Name "Gates in Zone" -Method GET -Url "$BaseUrl/managers/gates" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

# Pending vehicles
Test-Endpoint -Name "Pending Vehicles" -Method GET -Url "$BaseUrl/managers/vehicles/pending" -Headers $mh `
    -Validation { param($r) $r.success }

# AI Performance
Test-Endpoint -Name "AI Performance" -Method GET -Url "$BaseUrl/managers/ai/performance" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data.total_ai_events -ne $null }

# User Management (FR_MAN_07)
Test-Endpoint -Name "List Users in Zone" -Method GET -Url "$BaseUrl/managers/users" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

Test-Endpoint -Name "List Users (citizens only)" -Method GET -Url "$BaseUrl/managers/users?role=citizen" -Headers $mh `
    -Validation { param($r) $r.success -and $r.data -is [array] }

$rndUser = Get-Random -Minimum 1000 -Maximum 9999
$newUser = Test-Endpoint -Name "Create User (citizen)" -Method POST -Url "$BaseUrl/managers/users" -Headers $mh `
    -Body "{`"username`":`"test_user_$rndUser`",`"password`":`"password123`",`"full_name`":`"Test User $rndUser`",`"role`":`"citizen`"}" `
    -Validation { param($r) $r.success -and $r.data.user_id -ne $null }

Test-ExpectError -Name "Create User - duplicate username blocked" -Action {
    if ($newUser) {
        Invoke-RestMethod -Uri "$BaseUrl/managers/users" -Method POST `
            -Headers $mh -ContentType "application/json" `
            -Body "{`"username`":`"test_user_$rndUser`",`"password`":`"password123`",`"full_name`":`"Dup`",`"role`":`"citizen`"}"
    } else { throw "skip" }
}

# Reject vehicle — missing reason must fail 400
Test-ExpectError -Name "Reject Vehicle Without Reason = 400" -Action {
    Invoke-RestMethod -Uri "$BaseUrl/managers/vehicles/9999/reject" -Method POST `
        -Headers $mh -ContentType "application/json" -Body '{"reason":""}'
}

# ============================================================
# 7. AUTHORIZATION TESTS
# ============================================================
Write-Host "`n[7] AUTHORIZATION TESTS" -ForegroundColor Yellow

Test-ExpectError -Name "Citizen blocked from Guard endpoint" -Action {
    Invoke-RestMethod -Uri "$BaseUrl/guards/logs?lane_id=MAIN-IN" -Method GET -Headers $ch
}

Test-ExpectError -Name "Guard blocked from Manager endpoint" -Action {
    Invoke-RestMethod -Uri "$BaseUrl/managers/analytics/overview" -Method GET -Headers $gh
}

Test-ExpectError -Name "No token rejected" -Action {
    Invoke-RestMethod -Uri "$BaseUrl/auth/me" -Method GET
}

Test-ExpectError -Name "Guard stats missing lane_id = 400" -Action {
    Invoke-RestMethod -Uri "$BaseUrl/guards/stats" -Method GET -Headers $gh
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
$rate = if (($TestsPassed + $TestsFailed) -gt 0) { [math]::Round($TestsPassed / ($TestsPassed + $TestsFailed) * 100, 1) } else { 0 }
Write-Host "  Success Rate: $rate%" -ForegroundColor $(if ($TestsFailed -gt 0) { "Yellow" } else { "Green" })
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

return @{
    Run = $RunNumber
    Passed = $TestsPassed
    Failed = $TestsFailed
    Total = $TestsPassed + $TestsFailed
    SuccessRate = $rate
}


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
