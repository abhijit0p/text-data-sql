param(
    [string]$SessionId = "c40ed065-3bd0-4c70-9277-1944eab33b93",
    [string]$Prompt = "Who are the top 3 customers by total spending? Show their names and amounts."
)

$body = @{
    sessionId = $SessionId
    prompt    = $Prompt
} | ConvertTo-Json

Write-Host "Running Query: '$Prompt' against Session: $SessionId`n" -ForegroundColor Cyan

$response = Invoke-RestMethod -Uri "http://localhost:5000/api/query" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body

Write-Host "=== Generated SQL ===" -ForegroundColor Yellow
Write-Host $response.sql

Write-Host "`n=== Chart Recommendation ===" -ForegroundColor Yellow
$response.chartConfig | Format-List

Write-Host "=== Result Rows from DuckDB ===" -ForegroundColor Green
$response.rows | Format-Table -AutoSize