# Connection Test Script
# Run this after updating your DATABASE_URL

Write-Host "Testing Prisma connection..." -ForegroundColor Yellow
Write-Host ""

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim() -replace '^["'']|["'']$'
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
    Write-Host "Environment variables loaded" -ForegroundColor Green
} else {
    Write-Host ".env file not found!" -ForegroundColor Red
    exit 1
}

# Test connection
Write-Host "Running: npm run db:push" -ForegroundColor Cyan
npm run db:push
