@echo off
setlocal EnableExtensions
cd /d "%~dp0"

git rev-parse --show-toplevel >nul 2>&1
if errorlevel 1 (
  echo ERROR: This folder is not inside a Git repository.
  goto :failed
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if not defined BRANCH (
  echo ERROR: Git is in detached HEAD state. Check out a branch before syncing.
  goto :failed
)

for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "ORIGIN_URL=%%R"
if not defined ORIGIN_URL (
  echo ERROR: No Git remote named origin is configured.
  goto :failed
)

echo.
echo Ayavelisa Git sync
echo Branch: %BRANCH%
echo Remote: %ORIGIN_URL%
if /i not "%BRANCH%"=="main" echo WARNING: Render auto-deploys from main; this branch may not deploy.
echo.
echo 1. Push existing commits to GitHub
echo 2. Pull latest changes from GitHub
echo 3. Sync local changes with GitHub (commit, pull, push)
echo 4. Exit
echo.
choice /c 1234 /n /m "Choose an option: "
if errorlevel 4 goto :done
if errorlevel 3 goto :sync
if errorlevel 2 goto :pull
if errorlevel 1 goto :push
goto :failed

:push
call :require_clean
if errorlevel 1 goto :failed
git push origin "%BRANCH%"
if errorlevel 1 goto :failed
echo.
echo Push complete.
goto :done

:pull
call :require_clean
if errorlevel 1 goto :failed
git pull --rebase origin "%BRANCH%"
if errorlevel 1 goto :failed
echo.
echo Pull complete.
goto :done

:sync
git add -A
if errorlevel 1 goto :failed

git diff --cached --name-only | findstr /i /r /c:"^\.env" /c:"/\.env" >nul
if not errorlevel 1 (
  echo ERROR: An .env file is staged. Remove it from the Git index before syncing.
  echo Secrets and local environment files must not be committed.
  goto :failed
)

git diff --cached --quiet
if errorlevel 1 goto :commit_changes
goto :pull_push

:commit_changes
echo.
echo Changes staged for commit:
git diff --cached --stat
echo.
set /p "COMMIT_MESSAGE=Commit message: "
if not defined COMMIT_MESSAGE (
  echo ERROR: A commit message is required.
  goto :failed
)
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 goto :failed

:pull_push
git pull --rebase origin "%BRANCH%"
if errorlevel 1 (
  echo.
  echo Sync paused because the rebase did not finish. Resolve any conflicts,
  echo then run "git rebase --continue" and push again, or use "git rebase --abort".
  goto :failed
)

git push origin "%BRANCH%"
if errorlevel 1 goto :failed
echo.
echo Sync complete.
goto :done

:require_clean
git status --porcelain | findstr . >nul
if not errorlevel 1 (
  echo ERROR: The working tree has uncommitted changes.
  echo Choose Sync to commit local changes, or commit/stash them before continuing.
  exit /b 1
)
exit /b 0

:failed
echo.
echo Git operation did not complete. Review the message above; no local changes were discarded.
pause
exit /b 1

:done
echo.
pause
exit /b 0
