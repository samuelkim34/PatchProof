# PatchProof

**Don't just patch it. Prove it's fixed.**

PatchProof is an experimental AI-assisted security testing and remediation app. It inspects a public Python GitHub repository, identifies a potential vulnerability, attempts to reproduce it in an isolated Daytona sandbox, asks Gemini for a patch, and reruns the **same** security and regression tests. It produces a Git diff and a downloadable evidence report.

This is a hackathon prototype, **not** a comprehensive security scanner. A "verified" result means that the targeted tests passed, not that a repository is fully secure.

## Features

- **Repository audit (`/repo`):** Submit an authorized public GitHub repository URL. PatchProof inspects selected Python source files, investigates one candidate vulnerability, generates tests, attempts a one-file fix, runs unchanged checks, and records the result. This mode is experimental.
- **Guided demo (`/`):** A reproducible example demonstrating SQL injection before and after an AI-generated patch.
- **Evidence:** Live progress, source changes, test outcomes, and JSON report export.
- **Isolation:** Repository code, AI-generated tests, and Python security checks execute in Daytona cloud sandboxes, not on the developer's laptop. Sandboxes are cleaned up after each run.

## Requirements

PatchProof can be run locally from **macOS, Windows (PowerShell), or Linux**. The frontend/server uses Next.js and Node.js, not an OS-specific desktop application.

- [Node.js](https://nodejs.org/) **20.9 or later** with npm (Node.js 22 or 24 LTS is recommended)
- [Git](https://git-scm.com/downloads) to clone the repository
- A [Gemini API key](https://aistudio.google.com/apikey) with access to a supported model
- A [Daytona API key](https://app.daytona.io/) with available sandbox credits
- An internet connection

**You do not need Arch Linux, fish, Docker, WSL, or locally installed Python.** Daytona runs the repository's Python commands in its remote Linux sandbox. The dashboard and Node.js server run on your operating system. macOS and Windows are supported by the underlying frameworks, but this project has not yet been end-to-end verified on every OS.

## Quick start (macOS, Windows, Linux)

Open **Terminal** on macOS/Linux or **PowerShell / Windows Terminal** on Windows.

### 1. Clone and install

The following commands are the same on all three platforms:

```sh
git clone https://github.com/samuelkim34/PatchProof.git
cd PatchProof
npm ci
```

Use `npm ci` to install the versions recorded in `package-lock.json`. You do not need to create a new Next.js application or install individual SDKs.

### 2. Configure API keys

Copy the included example configuration to a local `.env` file:

**macOS / Linux (Terminal):**
```sh
cp .env.example .env
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

Open `.env` in any text editor and replace the placeholder values:

```dotenv
GEMINI_API_KEY=your_gemini_api_key
DAYTONA_API_KEY=your_daytona_api_key
```

Do **not** commit `.env` or share your keys. Next.js loads this file on the server; do not prefix these secrets with `NEXT_PUBLIC_`.

### 3. Launch

The commands are the same on macOS, Windows, and Linux:

```sh
npm run dev
```

Open **http://localhost:3000/repo** for repository auditing or **http://localhost:3000/** for the guided demo.

In the repository auditor, paste the URL of a **small public Python repository that you own or have permission to test**, confirm authorization, and run the audit. The original GitHub repository is never patched in place.

### 4. Check the production build (optional)

```sh
npm run build
npm run start
```

Use `npm run start` after a successful build instead of `npm run dev` to run locally in production mode. Stop either process with Ctrl+C.

## How verification works

1. **Clone:** Daytona creates a disposable sandbox and shallow-clones the authorized public repository.
2. **Inspect and triage:** Selected Python source snippets are sent to Gemini to identify one plausible security flaw.
3. **Reproduce:** Gemini generates security and regression tests. PatchProof requires normal behavior to pass and an exploit-blocking assertion to fail on the original vulnerable code. Failed test execution alone is **not** proof of exploitation.
4. **Patch:** Gemini returns a modified Python file, applied only inside the sandbox.
5. **Verify:** The same tests run again, the repository's existing `unittest` suite is attempted when available, and a Git diff is recorded.
6. **Report and cleanup:** The result is displayed and can be exported; Daytona deletes the temporary sandbox.

See [Repository audit documentation](README-REPOSITORY-AUDIT.md) for precise coverage and limitations.

## Current limitations

- Public GitHub repositories only; **Python** source only, a bounded set of files, one candidate finding and one patched file per scan.
- Best-effort built-in `unittest` discovery. Dependency installation, other languages, private repositories, arbitrary branches, and automatic pull requests are not supported yet.
- AI-generated vulnerability hypotheses and tests can be wrong. "Verified against targeted tests" is not a security guarantee.
- The cloud sandbox is Linux-based regardless of the user's local OS; this is intentional and does not require Linux locally.
- Gemini usage and Daytona sandbox activity consume quotas/credits. Free access depends on account eligibility and remaining allowances; **no ongoing $0 cost is guaranteed**.
- Hosted deployment is **not** the same as cross-platform local execution. Live audits are long-running and may exceed serverless time limits. The current shared demo access code is not adequate public-user authentication or rate limiting.

## Safety and deployment

- Test only repositories you are authorized to assess. Treat cloned repositories and generated tests as untrusted code.
- Do not submit private repositories or sensitive source. Selected public code snippets are sent to Gemini.
- Never commit `.env`. For a remotely hosted server, supply keys through server-side secrets and protect scan endpoints with real authentication, quotas, and rate limits.
- If an error indicates sandbox cleanup failed, delete that sandbox manually in the Daytona dashboard.
- Prefer a controlled local demo and screen recording for hackathon judging.

## Troubleshooting

- **`node` or `npm` not found:** Install Node.js and reopen your terminal. Check `node --version` and `npm --version`.
- **`git` not found:** Install Git and reopen your terminal.
- **Missing API key:** Verify `.env` is in the repository root and both key names are spelled exactly as shown. Restart the dev server after editing.
- **Gemini 503/429:** Model capacity or quota may be limiting requests. Do not enable paid billing just to resolve an outage.
- **Daytona SDK upload error involving `form-data`:** Keep `serverExternalPackages: ["@daytona/sdk"]` in `next.config.mjs` and restart Next.js.
- **Port 3000 already in use:** Stop your other local server or use the alternate port printed by Next.js.

Built for HackHarvard.
