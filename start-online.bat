@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM يشغل السيرفر + نفق Cloudflare مجاني عشان صحابك يدخلوا من أي مكان بالعالم
where cloudflared >nul 2>nul || (
  echo لازم تثبّت cloudflared مرة وحدة. شغّل هذا الأمر ثم أعد تشغيل الملف:
  echo    winget install Cloudflare.cloudflared
  pause & exit /b )
if not exist node_modules call npm install
start "BlobBrawl Server" cmd /k node server.js
timeout /t 2 >nul
echo ابحث عن الرابط اللي ينتهي بـ trycloudflare.com وابعته لصحابك
cloudflared tunnel --url http://localhost:3000
pause
