@echo off
REM ============================================================
REM  T3 / AI Egitim Sistemi - gelistirme baslatici
REM
REM  Kullanim:
REM    start.bat          -> paketleri kontrol et + npm run dev
REM    start.bat build    -> npm run build + npm run start
REM    start.bat clean    -> .next ve node_modules sil, sifirdan kur
REM ============================================================
REM  KAPSAM SOZU (2026-08-24) - bu script SADECE bu klasore dokunur:
REM    - port      : 8080 (ve orada bir sey varsa ONCE sorar)
REM    - dosyalar  : bu klasordeki .next / node_modules / .start-cache
REM  Docker'a HIC dokunmaz: bu proje Next.js + Supabase, container
REM  gerektirmez. Engine kapaliysa kapali kalir, acmaz. Diger
REM  projelerin (borsa-botu, morf, VMCP) container'lari yalnizca
REM  ayaktaysa BILGI AMACLI listelenir - hicbiri durdurulmaz.
REM
REM  Neden bu not var: Docker engine acilinca "restart: unless-stopped"
REM  politikali eski container'lar kendiliginden geri geliyor ve 16 GB'lik
REM  makinede RAM'i doldurup donmaya yol aciyordu. T3 uzerinde
REM  calisirken hicbir container'a ihtiyacin yok.
REM ============================================================
setlocal EnableExtensions EnableDelayedExpansion
title T3 - AI Egitim Sistemi
cd /d "%~dp0"

set "PORT=8080"
set "CACHE_DIR=.start-cache"
set "OPEN_BROWSER=1"

set "MODE=%~1"
if "%MODE%"=="" set "MODE=dev"

REM --- tarayiciyi geciktirmeli acan ic mod ---
if /i "%MODE%"=="__open" (
  timeout /t 7 /nobreak >nul
  start "" "http://localhost:%PORT%/"
  exit /b
)

echo.
echo =====================================================
echo    T3 / AI Egitim Sistemi
echo =====================================================

REM ---------- Node kontrolu ----------
where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [HATA] Node.js bulunamadi. https://nodejs.org uzerinden kurun.
  goto :son
)
for /f "delims=" %%v in ('node -v') do set "NODEV=%%v"

REM ---------- Git dal bilgisi ----------
set "BRANCH=-"
set "DIRTY="
where git >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "BRANCH=%%b"
  for /f "delims=" %%s in ('git status --porcelain 2^>nul') do set "DIRTY=1"
)

echo    Node   : %NODEV%
echo    Dal    : !BRANCH!
if defined DIRTY echo    Durum  : commit edilmemis degisiklikler var
echo    Adres  : http://localhost:%PORT%
echo =====================================================
echo.

if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%" >nul 2>&1

REM ---------- clean modu ----------
if /i "%MODE%"=="clean" (
  echo   [temizlik] .next ve node_modules siliniyor...
  if exist ".next" rmdir /s /q ".next"
  if exist "node_modules" rmdir /s /q "node_modules"
  if exist "tsconfig.tsbuildinfo" del /q "tsconfig.tsbuildinfo" >nul 2>&1
  if exist "%CACHE_DIR%\deps.stamp" del /q "%CACHE_DIR%\deps.stamp" >nul 2>&1
  if exist "%CACHE_DIR%\branch.stamp" del /q "%CACHE_DIR%\branch.stamp" >nul 2>&1
  set "MODE=dev"
)

REM ---------- 1/4  ortam degiskenleri ----------
if exist ".env.local" (
  echo   [1/4] Ortam    : .env.local kullaniliyor
) else if exist ".env" (
  echo   [1/4] Ortam    : .env kullaniliyor
) else (
  echo   [1/4] Ortam    : .env yok - demo/mock modda calisir
)

REM ---------- 2/4  dal degisti mi ----------
set "PREVBRANCH="
if exist "%CACHE_DIR%\branch.stamp" set /p PREVBRANCH=<"%CACHE_DIR%\branch.stamp"
if not "!PREVBRANCH!"=="" if not "!PREVBRANCH!"=="!BRANCH!" (
  echo   [2/4] Onbellek : dal degisti ^(!PREVBRANCH! -^> !BRANCH!^), .next siliniyor
  if exist ".next" rmdir /s /q ".next"
  if exist "tsconfig.tsbuildinfo" del /q "tsconfig.tsbuildinfo" >nul 2>&1
) else (
  echo   [2/4] Onbellek : guncel
)
> "%CACHE_DIR%\branch.stamp" echo !BRANCH!

REM ---------- 3/4  bagimliliklar ----------
set "NEEDINSTALL=0"
if not exist "node_modules" set "NEEDINSTALL=1"
if not exist "node_modules\.package-lock.json" set "NEEDINSTALL=1"

set "LOCKSTAMP="
for %%f in ("package-lock.json") do set "LOCKSTAMP=%%~tf %%~zf"
set "PREVSTAMP="
if exist "%CACHE_DIR%\deps.stamp" set /p PREVSTAMP=<"%CACHE_DIR%\deps.stamp"
if not "!LOCKSTAMP!"=="!PREVSTAMP!" set "NEEDINSTALL=1"

if "!NEEDINSTALL!"=="1" (
  echo   [3/4] Paketler : npm install calisiyor, biraz surebilir...
  call npm install
  if errorlevel 1 (
    echo.
    echo   [HATA] npm install basarisiz oldu.
    goto :son
  )
  > "%CACHE_DIR%\deps.stamp" echo !LOCKSTAMP!
) else (
  echo   [3/4] Paketler : guncel
)

REM ---------- port bos mu ----------
set "PIDONPORT="
for /f "tokens=5" %%p in ('netstat -ano -p tcp 2^>nul ^| findstr /r /c:":%PORT% .*LISTENING"') do set "PIDONPORT=%%p"
if not "!PIDONPORT!"=="" (
  REM Sureci ADIYLA goster: 8080'i tutan sey baska bir projenin sunucusu
  REM olabilir. Kapsam sozu geregi kimseyi sormadan oldurmuyoruz.
  set "PROCNAME=?"
  for /f "tokens=1 delims=," %%n in ('tasklist /fi "PID eq !PIDONPORT!" /nh /fo csv 2^>nul') do set "PROCNAME=%%~n"
  echo.
  echo   [UYARI] %PORT% portu kullanimda ^(PID !PIDONPORT! - !PROCNAME!^).
  echo           Bu T3'un onceki sunucusu degilse ^(baska bir proje^) [H]ayir deyin.
  choice /c EH /n /m "          Bu islemi kapatayim mi? [E]vet / [H]ayir: "
  if errorlevel 2 (
    echo          Devam ediliyor - Next.js baska bir porta gecebilir.
    set "OPEN_BROWSER=0"
  ) else (
    taskkill /f /pid !PIDONPORT! >nul 2>&1
    echo          PID !PIDONPORT! kapatildi.
  )
)

REM ---------- SALT-OKUNUR: bosuna RAM yiyen container var mi? ----------
REM  T3 hicbir container'a ihtiyac duymaz. Docker engine kapaliysa bu blok
REM  sessizce atlanir - engine ACILMAZ, hicbir container durdurulmaz.
where docker >nul 2>&1
if not errorlevel 1 (
  set /a DSAYI=0
  for /f "delims=" %%c in ('docker ps --format "{{.Names}}" 2^>nul') do (
    set /a DSAYI+=1
    if !DSAYI!==1 echo   [i] Ayakta olan container'lar ^(T3 icin gereksiz, dokunulmadi^):
    echo         - %%c
  )
  if !DSAYI! GTR 0 (
    echo       !DSAYI! container RAM tuketiyor. Sadece T3 ile calisacaksan
    echo       ilgili projenin durdurma dosyasini calistirip RAM'i geri alabilirsin.
    echo.
  )
)

REM ---------- 4/4  calistir ----------
if "%OPEN_BROWSER%"=="1" start "T3-tarayici" /min "%~f0" __open

if /i "%MODE%"=="build" (
  echo   [4/4] Uretim derlemesi: npm run build
  echo.
  call npm run build
  if errorlevel 1 goto :son
  echo.
  echo   Uretim sunucusu: http://localhost:%PORT%
  call npm run start
  goto :son
)

echo   [4/4] Gelistirme sunucusu baslatiliyor ^(durdurmak icin Ctrl+C^)
echo.
call npm run dev

:son
echo.
echo   Sunucu durdu. Pencereyi kapatmak icin bir tusa basin.
pause >nul
endlocal
