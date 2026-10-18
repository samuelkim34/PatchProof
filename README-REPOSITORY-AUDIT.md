# PatchProof — Public GitHub Repository Audit (experimental)

The `/repo` page is part of this Next.js repository and works alongside the guided demo at `/`. No separate ZIP, Arch Linux setup, or shell-specific installation is required.

## Installation (macOS, Windows, Linux)

Follow the universal [Quick start](README.md#quick-start-macos-windows-linux): install Node.js 20.9+, clone this repository, run `npm ci`, create `.env` from `.env.example` with your own Gemini and Daytona keys, and run `npm run dev`.

Visit <http://localhost:3000/repo>. On Windows use PowerShell or Windows Terminal; on macOS/Linux use your normal terminal. Daytona executes Python in its own cloud Linux sandbox, so local Python, Docker, WSL and Linux are not required. Keep `next.config.mjs` configured to externalize `@daytona/sdk` for Node.js server execution.

## What it actually does

1. Accepts **only a public GitHub repository URL** of the form `https://github.com/owner/repo`, and requires you to affirm authorization.
2. Creates a Daytona Python sandbox, shallow-clones the repository there, and inventories **up to 250 Python modules**. It sends a bounded selection of up to 18 small candidate Python source snippets to Gemini to identify one potential flaw.
3. If Gemini selects a file, fetches the original source into a separate isolated test directory and asks Gemini for a regression test and a security exploit test.
4. Requires the normal test to **pass on the original**, and the security test to **fail by assertion** on the original (a runtime error alone is not accepted as a reproduced exploit).
5. Attempts to run the repository's existing `unittest` suite from `tests/`, without downloading arbitrary dependencies. Clearly records skipped or failed runs.
6. Requests a one-file fix from Gemini, applies it **only inside Daytona**, reruns the **unchanged tests**, checks Python syntax and captures a real `git diff`.
7. Marks `verified_against_targeted_tests` only when those checks pass, the diff is nonempty, and an initially passing repository suite has not regressed. Finally deletes the temporary sandbox.
8. Streams progress to the browser and offers an exportable JSON report.

## Trying it with a controlled sample

The optional `examples/vulnerable-python-repo/` folder contains a deliberately vulnerable Python + SQLite login module and a basic `unittest` suite. Create a **separate new public GitHub repository owned by you**, upload the files from that directory, then paste its public repository URL into `/repo`.

The AI is *not* told to pick that sample file, and the scan engine does not contain a hardcoded vulnerable SQL login file. Results can vary across model runs. A complex or dependency-heavy repository may yield `no_candidate_found`, `inconclusive_regression_failed`, or `candidate_not_reproduced`; these are honest outcomes, not false successes.

## Security, reliability and cost limits

- Only scan repositories you own or are authorized to test. Python only, default GitHub branch, one candidate and one changed file per scan. `pytest`, JavaScript/TypeScript, arbitrary GitHub branches, monorepo dependency installation, CI, and creating pull requests are **not yet supported**.
- The scan limits source review and size (shallow clone, max 80 MB after cloning). Some files are omitted; source may contain prompt-injection attempts. Public source snippets are sent to Gemini. **Do not submit private code or secrets.**
- User code, AI-generated Python tests, and repository's existing unit tests execute in Daytona, not on your laptop. This is still an experiment: do not trust unknown repositories with access to production secrets; run sandboxes without credentials.
- Only standard-library `unittest` discovery is attempted automatically; no `pip install`, `npm install`, model-generated shell commands, or untrusted dependency installation.
- `verified_against_targeted_tests` means **one reproduced test failed originally and passed after one patch**. It does not mean the full project is safe. AI-generated assertions may be inadequate. A missing original test suite is shown as `not_available`.
- If you deploy, set `PATCHPROOF_DEMO_CODE` server-side. This check prevents open access but is **not enough for a publicly scalable service**: add server-side auth, durable job queues, rate limits and usage quotas. Serverless hosting may time out on long repository scans; **demo locally**.
- Keep `.env` ignored. Calls consume Gemini free-tier quota and Daytona trial credits, which are finite. Neither can be guaranteed free forever. If cleanup reports failure, delete the sandbox manually from the Daytona dashboard.

## Smoke test

Run `npm run build`, start the development server, visit `/repo`, paste the URL of a small Python repository you own, check the authorization box, then click **Run repository audit**. Confirm the before/after test outcomes and that a sandbox cleanup event arrives. If the Gemini model is overloaded, the engine attempts the Flash Lite fallback. Back up your working branch before editing the main demo.
