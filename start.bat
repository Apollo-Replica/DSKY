@echo off 

setlocal

set "PORT=3000"
set "URL=http://localhost:%PORT%"

echo Checking if Next-DSKY is already running on port %PORT%...
netstat -ano | find "LISTENING" | find ":%PORT%" >nul
if errorlevel 1 (
    echo Starting Next-DSKY...
    pushd "%~dp0Programs\next-dsky" || exit /b 1

    rem Install deps only if needed
    if not exist "node_modules\" (
        if exist package-lock.json (
            call npm ci
        ) else (
            call npm install
        )
    ) else (
        echo node_modules already present; skipping install.
    )

    rem Skip build if a valid Next.js build exists
    set "NEEDS_BUILD=1"
    if exist ".next\BUILD_ID" if exist ".next\build-manifest.json" (
        for %%A in (".next\BUILD_ID") do if %%~zA GTR 0 (
            set "NEEDS_BUILD=0"
        )
    )

    if "%NEEDS_BUILD%"=="1" (
        rem Open browser once the server starts (runs in background)
        start "" /B powershell -NoProfile -Command "$p=%PORT%; $u='%URL%'; for($i=0; $i -lt 60; $i++){ if(Test-NetConnection -ComputerName 'localhost' -Port $p -InformationLevel Quiet){ Start-Process $u; exit 0 }; Start-Sleep -Seconds 1 }"
        call npm run build
        call npm start
    ) else (
        echo Existing Next.js build detected; skipping build.
        rem Open browser once the server starts (runs in background)
        start "" /B powershell -NoProfile -Command "$p=%PORT%; $u='%URL%'; for($i=0; $i -lt 60; $i++){ if(Test-NetConnection -ComputerName 'localhost' -Port $p -InformationLevel Quiet){ Start-Process $u; exit 0 }; Start-Sleep -Seconds 1 }"
        call npm start
    )
    popd
) else (
    echo Next-DSKY is already running.
    start "" "%URL%"
    exit /b 0
)
exit /b %errorlevel%
