# Fix Java 21 Compiler Compliance Issue
# This script sets up the environment to use JDK 21 instead of JDK 1.8

Write-Host "Setting up Java 21 environment..." -ForegroundColor Green

# Set JAVA_HOME to JDK 21
$env:JAVA_HOME = "C:\Users\User\.jdk\jdk-21.0.8"

Write-Host "JAVA_HOME set to: $($env:JAVA_HOME)" -ForegroundColor Cyan

# Verify Java version
Write-Host "`nVerifying Java version..." -ForegroundColor Cyan
& "$($env:JAVA_HOME)\bin\java" -version 2>&1

# Update PATH to prioritize Maven and JDK 21
$env:Path = "$($env:JAVA_HOME)\bin;C:\Users\User\.maven\maven-3.9.14\bin;$($env:Path)"

Write-Host "`nVerifying Maven version..." -ForegroundColor Cyan
& "C:\Users\User\.maven\maven-3.9.14\bin\mvn" -version 2>&1

Write-Host "`n✓ Java 21 environment is ready!" -ForegroundColor Green
Write-Host "`nTo compile the project, run:" -ForegroundColor Yellow
Write-Host "  cd java-ml`n  mvn clean compile" -ForegroundColor Yellow
