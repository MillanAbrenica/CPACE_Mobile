@echo off
REM Starts the CPACE Mobile API with XAMPP's PHP on port 8080.
REM Keep this window open while using the mobile app.
echo CPACE Mobile API running at http://localhost:8080/api
"C:\xampp\php\php.exe" -S 0.0.0.0:8080 "%~dp0index.php"
