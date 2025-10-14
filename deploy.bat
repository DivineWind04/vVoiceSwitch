@echo off
REM vIVSR Deployment Script for Windows

echo 🚀 Starting vIVSR Web App Deployment

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i

echo ✅ Node.js version: %NODE_VERSION%
echo ✅ npm version: %NPM_VERSION%

REM Install dependencies
echo 📦 Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Installation failed!
    pause
    exit /b 1
)

REM Build the application
echo 🔨 Building application...
call npm run build

if %errorlevel% equ 0 (
    echo ✅ Build successful!
    echo.
    echo 🎉 Deployment ready!
    echo.
    echo To start the production server:
    echo   npm run start
    echo.
    echo The app will be available at: http://localhost:3000
    echo.
    echo 📋 User Requirements:
    echo   • AFV service running on ws://localhost:9002
    echo   • Modern web browser with audio permissions
    echo   • Position data in /public/zoa_position.json
    echo.
    echo 🌐 UI Access Points:
    echo   • Main: http://localhost:3000
    echo   • VSCS: http://localhost:3000/vscs
    echo   • ETVS: http://localhost:3000/etvs
    echo   • STVS: http://localhost:3000/stvs
    echo   • IVSR: http://localhost:3000/ivsr
    echo   • RDVS: http://localhost:3000/rdvs
) else (
    echo ❌ Build failed!
    pause
    exit /b 1
)

pause