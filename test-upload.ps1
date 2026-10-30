$filePath = Join-Path $PSScriptRoot "sample-data.xlsx"

if (-not (Test-Path $filePath)) {
    Write-Error "File not found: $filePath"
    exit 1
}

Write-Host "Uploading $filePath to http://localhost:5000/api/upload..." -ForegroundColor Cyan

$rawResponse = curl.exe -s -F "file=@$filePath" http://localhost:5000/api/upload

if (-not $rawResponse) {
    Write-Error "No response received. Is the server running on port 5000?"
    exit 1
}

$response = $rawResponse | ConvertFrom-Json

Write-Host "Generated Session ID: $($response.sessionId)" -ForegroundColor Green

if ($response.widgets) {
    $response.widgets | Format-Table -Property @{Label="Title"; Expression={$_.chartConfig.title}}, @{Label="Type"; Expression={$_.chartConfig.recommendedType}}, sql
} else {
    $response | Format-List
}
