# PatchProof — HackHarvard live dashboard add-on

This ZIP is an **add-on for your already working `~/Projects/patchproof` project**. It includes only `app/` and `lib/` and does NOT replace `.env`, `package.json`, or your working scripts.

## Install (Arch Linux, fish)

1. Download this ZIP to ~/Downloads.
2. In fish:

```fish
cd ~/Projects/patchproof
python3 -m zipfile -e ~/Downloads/patchproof-dashboard.zip .
npm install next react react-dom
npm pkg set 'scripts.dev=next dev' 'scripts.build=next build' 'scripts.start=next start'
npm run dev
```

3. Open http://localhost:3000 in Firefox and click **Run live security test**.
4. Next.js automatically loads your existing `.env` file, so **do not paste keys into web pages or public code**.

## What it does

- Actually runs the same five Python tests against a deliberately SQL-injection-vulnerable SQLite login fixture, inside Daytona.
- Requests a patch from `gemini-3.6-flash` (falls back to `gemini-3.5-flash-lite` on 503 errors).
- Executes the unchanged five tests after installing the patched code in the sandbox.
- Streams actual state changes, code, and test results to the browser as JSON Lines.
- Deletes the disposable sandbox in `finally`, even when verification fails (cleanup errors are shown).
- Exports a JSON report with before/after results and the generated code.

## Safety, budget, and limits

- **Demo-only**: fixed intentionally vulnerable Python code; do not deploy the fixture as an authentication service. No arbitrary repo uploads or arbitrary user commands are accepted.
- API keys stay server-side in `.env`; do not rename them with `NEXT_PUBLIC_` prefixes. `.env` must remain in `.gitignore`.
- Each live run uses free-tier Gemini quota and Daytona introductory credits. Repeated runs cost credits even if they do not require immediate payment.
- This is a five-check proof-of-fix, not comprehensive application security coverage.
- **Deploying**: Vercel is optional. The API route will refuse scans on Vercel unless `PATCHPROOF_DEMO_CODE` is configured as a server environment variable. If deploying, enter that code in the dashboard. This prevents open anonymous use, but **a shared demo code is not a rate limiter**; protect credits and do not publicize it. Cloud serverless request duration may prevent full scans, so first demo locally.
- If the sandbox cleanup reports a failure, manually delete that sandbox in the Daytona dashboard.

## Manual checks before submitting

- Open the dashboard and click Run. Observe before data (3 good, 2 vulnerable), generated code, and after data (5 good) with a "PATCH VERIFIED" terminal event.
- Try `npm run build`, verify API keys stay in `.env` and out of git.
- Record a real demo video as backup for judges.
