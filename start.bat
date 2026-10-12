@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js مش مثبت. نزله من https://nodejs.org ثم شغّل الملف مرة ثانية & pause & exit /b)
if not exist node_modules (echo جاري تثبيت الملفات... & call npm install)
echo.
echo  افتح اللعبة من الرابط Local، وصحابك على نفس الواي فاي يستخدموا رابط Network
echo.
start "" http://localhost:3000
node server.js
pause
