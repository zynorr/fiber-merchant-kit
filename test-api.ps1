# +------------------------------------------------------------+
# |   Fiber Merchant Kit - API Test Script                      |
# |   Run this AFTER starting the API server                    |
# |   Usage: .\test-api.ps1 -ApiKey "fm_sk_..."                 |
# +------------------------------------------------------------+

param(
    [Parameter(Mandatory = $false)]
    [string]$ApiKey = "",

    [Parameter(Mandatory = $false)]
    [string]$BaseUrl = "http://localhost:3001"
)

$API = "$BaseUrl/api/v1"
$PASS = 0
$FAIL = 0
$INVOICE_ID = ""
$WEBHOOK_ID = ""

function Test-Step {
    param($Name, $Method, $Url, $Body, $ExpectedStatus = 200)
    
    Write-Host "`n-------------------------------------------------" -ForegroundColor Cyan
    Write-Host "Testing: $Name" -ForegroundColor White
    Write-Host "  $Method $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Method = $Method
            Uri = $Url
            ContentType = "application/json"
        }
        
        if ($ApiKey -ne "") {
            $params.Headers = @{ Authorization = "Bearer $ApiKey" }
        }
        
        if ($Body) {
            $params.Body = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-WebRequest @params -UseBasicParsing -ErrorAction Stop
        
        $statusCode = [int]$response.StatusCode
        
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "  PASS (HTTP $statusCode)" -ForegroundColor Green
            $script:PASS++
            if ($response.Content) {
                $content = $response.Content | ConvertFrom-Json
                Write-Host "  Response preview:" -ForegroundColor DarkGray
                Write-Host "    $($content | ConvertTo-Json -Compress -Depth 3)".Substring(0, [Math]::Min(200, ($content | ConvertTo-Json -Compress -Depth 3).Length)) -ForegroundColor DarkGray
            }
            return $content
        } else {
            Write-Host "  FAIL - Expected $ExpectedStatus, got $statusCode" -ForegroundColor Red
            if ($response.Content) { Write-Host "  Response: $($response.Content)" -ForegroundColor Red }
            $script:FAIL++
            return $null
        }
    } catch {
        Write-Host "  FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:FAIL++
        return $null
    }
}

# ===============================================================
Write-Host "+--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "|     Fiber Merchant Kit - API Test Suite                     |" -ForegroundColor Cyan
Write-Host "|     $API" -ForegroundColor Cyan
Write-Host "+--------------------------------------------------------------+" -ForegroundColor Cyan
Write-Host "Starting tests..." -ForegroundColor Yellow

# -- 1. Health Check -------------------------------------------
Write-Host "`n===============================================================" -ForegroundColor Magenta
Write-Host "  SECTION 1: HEALTH CHECK" -ForegroundColor Magenta

$health = Test-Step -Name "Health Check (no auth)" -Method Get -Url "$API/health"

if (-not $health) {
    Write-Host "`n  Cannot reach server. Is it running?" -ForegroundColor Red
    Write-Host "  Start it with: npm run dev --workspace=packages/api-server" -ForegroundColor Yellow
    Write-Host "`n-------------------------------------------------" -ForegroundColor Cyan
    exit 1
}

if ($ApiKey -eq "") {
    Write-Host "`n  No API key provided. Testing public endpoints only." -ForegroundColor Yellow
    Write-Host "  Restart with: .\test-api.ps1 -ApiKey fm_sk_YOUR_KEY" -ForegroundColor Gray
} else {
    # -- 2. Invoices ---------------------------------------------
    Write-Host "`n===============================================================" -ForegroundColor Magenta
    Write-Host "  SECTION 2: INVOICES" -ForegroundColor Magenta

    # 2a. Create Invoice
    $invoice = Test-Step -Name "Create Invoice" -Method Post -Url "$API/invoices" -Body @{
        amount = "50000"
        currency = "CKB"
        description = "Test Order #001 - Fiber Merchant Kit"
        metadata = @{ orderId = "ORD-001"; customerId = "cus_test" }
        expiry = 3600
    } -ExpectedStatus 201

    if ($invoice) {
        $INVOICE_ID = $invoice.id
        Write-Host "  Invoice ID: $INVOICE_ID" -ForegroundColor Cyan
    }

    # 2b. Get Invoice
    if ($INVOICE_ID) {
        Test-Step -Name "Get Invoice" -Method Get -Url "$API/invoices/$INVOICE_ID"

        # 2c. Get Invoice QR Code
        Test-Step -Name "Get QR Code" -Method Get -Url "$API/invoices/$INVOICE_ID/qr"

        # 2d. List Invoices
        Test-Step -Name "List Invoices" -Method Get -Url "$API/invoices"

        # 2e. Create a 2nd invoice for listing test
        Test-Step -Name "Create 2nd Invoice" -Method Post -Url "$API/invoices" -Body @{
            amount = "25000"
            currency = "RUSD"
            description = "Test Order #002"
        } -ExpectedStatus 201

        # 2f. Cancel Invoice
        Test-Step -Name "Cancel Invoice" -Method Post -Url "$API/invoices/$INVOICE_ID/cancel"

        # 2g. Verify cancelled status
        Test-Step -Name "Verify Cancelled Status" -Method Get -Url "$API/invoices/$INVOICE_ID"
    }

    # -- 3. Webhooks ---------------------------------------------
    Write-Host "`n===============================================================" -ForegroundColor Magenta
    Write-Host "  SECTION 3: WEBHOOKS" -ForegroundColor Magenta

    # 3a. Register webhook
    $webhook = Test-Step -Name "Register Webhook" -Method Post -Url "$API/webhooks" -Body @{
        url = "https://httpbin.org/post"
        events = @("invoice.paid", "invoice.expired", "invoice.created")
        description = "Test webhook"
    } -ExpectedStatus 201

    if ($webhook) {
        $WEBHOOK_ID = $webhook.id
        Write-Host "  Webhook Secret: $($webhook.secret)" -ForegroundColor Cyan
    }

    # 3b. List webhooks
    Test-Step -Name "List Webhooks" -Method Get -Url "$API/webhooks"

    # 3c. Get webhook
    if ($WEBHOOK_ID) {
        Test-Step -Name "Get Webhook" -Method Get -Url "$API/webhooks/$WEBHOOK_ID"

        # 3d. Test webhook
        Test-Step -Name "Test Webhook" -Method Post -Url "$API/webhooks/$WEBHOOK_ID/test"

        # 3e. Get delivery logs
        Test-Step -Name "Get Delivery Logs" -Method Get -Url "$API/webhooks/$WEBHOOK_ID/deliveries"
    }

    # -- 4. Balance -----------------------------------------------
    Write-Host "`n===============================================================" -ForegroundColor Magenta
    Write-Host "  SECTION 4: BALANCE" -ForegroundColor Magenta

    Test-Step -Name "Channel Balances" -Method Get -Url "$API/balance/channels"
    Test-Step -Name "Total Balance" -Method Get -Url "$API/balance/total"

    # -- 5. Transactions ------------------------------------------
    Write-Host "`n===============================================================" -ForegroundColor Magenta
    Write-Host "  SECTION 5: TRANSACTIONS" -ForegroundColor Magenta

    $txns = Test-Step -Name "List Transactions" -Method Get -Url "$API/transactions"

    # -- 6. Stats -------------------------------------------------
    Write-Host "`n===============================================================" -ForegroundColor Magenta
    Write-Host "  SECTION 6: STATISTICS" -ForegroundColor Magenta

    Test-Step -Name "Dashboard Stats" -Method Get -Url "$API/stats"
    Test-Step -Name "Revenue History" -Method Get -Url "$API/stats/revenue?days=7"

    # -- 7. Error Cases --------------------------------------------
    Write-Host "`n===============================================================" -ForegroundColor Magenta
    Write-Host "  SECTION 7: ERROR HANDLING" -ForegroundColor Magenta

    # 7a. Missing auth
    try {
        $response = Invoke-WebRequest -Method Get -Uri "$API/invoices" -UseBasicParsing -ErrorAction Stop
        Write-Host "  FAIL - Expected 401 for missing auth" -ForegroundColor Red
        $script:FAIL++
    } catch {
        if ($_.Exception.Response.StatusCode -eq 401) {
            Write-Host "  PASS - Missing auth returns 401" -ForegroundColor Green
            $script:PASS++
        } else {
            Write-Host "  FAIL - Expected 401, got $($_.Exception.Response.StatusCode)" -ForegroundColor Red
            $script:FAIL++
        }
    }

    # 7b. Invalid invoice ID
    Test-Step -Name "Invalid Invoice ID" -Method Get -Url "$API/invoices/nonexistent-id" -ExpectedStatus 404

    # 7c. Invalid webhook URL
    Test-Step -Name "Invalid Webhook URL" -Method Post -Url "$API/webhooks" -Body @{
        url = "not-a-valid-url"
        events = @("invoice.paid")
    } -ExpectedStatus 400
}

# -- Summary -------------------------------------------------
Write-Host "`n" -NoNewline
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "  TEST RESULTS" -ForegroundColor Cyan
Write-Host "  Passed: $PASS" -ForegroundColor Green
Write-Host "  Failed: $FAIL" -ForegroundColor Red
if ($FAIL -eq 0) {
    Write-Host "  ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "  Some tests failed - check details above" -ForegroundColor Yellow
}
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "`n"
