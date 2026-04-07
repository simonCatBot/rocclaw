@echo off
echo Starting rocCLAW...
echo Make sure you have Node.js 20.9+ installed

REM Install dependencies (--include=dev required so TypeScript is available to
REM transpile next.config.ts at startup; omitting dev deps causes a MODULE_NOT_FOUND
REM error for 'typescript' in the Next.js config transpiler)
call npm ci --include=dev

REM Start the server
node server/index.js
