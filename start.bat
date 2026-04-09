@echo off
REM rocCLAW startup script for Windows
REM This script starts the rocCLAW server

setlocal EnableDelayedExpansion

cd /d "%~dp0"

REM Check for Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js 20.9.0 or higher from https://nodejs.org/
    exit /b 1
)

REM Check Node.js version (basic check)
for /f "tokens=1 delims=v." %%a in ('node --version') do (
    set NODE_MAJOR=%%a
)
if !NODE_MAJOR! LSS 20 (
    echo Error: Node.js version 20.9.0 or higher is required
    for /f "tokens=*" %%a in ('node --version') do echo Current version: %%a
    exit /b 1
)

REM Verify native runtime dependencies
echo Verifying native runtime dependencies...
node scripts\verify-native-runtime.mjs --check
if errorlevel 1 (
    echo Attempting to repair native runtime dependencies...
    node scripts\verify-native-runtime.mjs --repair
)

REM Start the server
echo Starting rocCLAW server...
node server\index.js %*
