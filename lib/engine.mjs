import { GoogleGenAI } from '@google/genai';
import { Daytona } from '@daytona/sdk';

// This is a FIXED, deliberately vulnerable educational example, not a user-code executor.
export const VULNERABLE_CODE = `import sqlite3

def authenticate(username, password):
    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE users (username TEXT, password TEXT)")
        conn.execute("INSERT INTO users VALUES (?, ?)", ("admin", "demo-password-123"))
        query = f"SELECT username FROM users WHERE username = '{username}' AND password = '{password}'"
        return conn.execute(query).fetchone() is not None
    finally:
        conn.close()
`;

const TESTS = `import json
from login import authenticate

results = {
    "legitimate_login_works": authenticate("admin", "demo-password-123"),
    "wrong_password_rejected": not authenticate("admin", "incorrect"),
    "unknown_user_rejected": not authenticate("nobody", "demo-password-123"),
    "username_injection_blocked": not authenticate("' OR 1=1 -- ", "incorrect"),
    "password_injection_blocked": not authenticate("admin", "' OR 1=1 -- "),
}
print(json.dumps(results))
`;

const TEST_KEYS = [
  'legitimate_login_works',
  'wrong_password_rejected',
  'unknown_user_rejected',
  'username_injection_blocked',
  'password_injection_blocked',
];

const PROMPT = `Fix SQL injection in this intentionally vulnerable Python SQLite demo. Return only the complete corrected Python file (no markdown, commentary, or extra files). Keep the authenticate(username, password) signature, the in-memory demo database, the same admin seed user, and behavior for valid/invalid credentials. Use parameterized SQL placeholders and bound parameters for the authentication query. Do not hardcode sample attack payloads, bypass authentication, or replace SQL with non-database logic.\n\n${VULNERABLE_CODE}`;

function isTemporaryOverload(error) {
  return error?.status === 503 || error?.code === 503 ||
    /"code"\s*:\s*503|"status"\s*:\s*"UNAVAILABLE"|high demand/i.test(String(error?.message ?? ''));
}

function cleanPythonResponse(response) {
  let value = (response?.text ?? '').trim();
  const fence = value.match(/^```(?:python)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) value = fence[1].trim();
  if (!value.includes('def authenticate(')) {
    throw new Error('Gemini did not return a Python authenticate function.');
  }
  return value + '\n';
}

function requireExactKeys(values) {
  return values && typeof values === 'object' &&
    Object.keys(values).length === TEST_KEYS.length &&
    TEST_KEYS.every((key) => typeof values[key] === 'boolean');
}

// emit() sends only sanitized progress/results to the dashboard.
export async function runProof(emit = () => {}) {
  if (!process.env.GEMINI_API_KEY || !process.env.DAYTONA_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY or DAYTONA_API_KEY in your project .env file.');
  }
  let sandbox;
  let failure;
  const daytona = new Daytona();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  let model = process.env.PATCHPROOF_MODEL || 'gemini-3.6-flash';

  const probe = async () => {
    const cmd = await sandbox.process.executeCommand('python3 probe.py', '/tmp/patchproof', undefined, 30);
    if (cmd.exitCode !== 0) {
      throw new Error(`Python verification failed: ${String(cmd.result).slice(0, 1500)}`);
    }
    let data;
    try { data = JSON.parse(cmd.result.trim()); }
    catch { throw new Error('Security tests returned invalid JSON.'); }
    if (!requireExactKeys(data)) throw new Error('Unexpected test result format.');
    return data;
  };

  try {
    emit({ type: 'stage', stage: 'sandbox', message: 'Creating isolated Daytona sandbox' });
    sandbox = await daytona.create({ language: 'python', ephemeral: true, autoStopInterval: 5 });
    const setup = await sandbox.process.executeCommand('mkdir -p /tmp/patchproof');
    if (setup.exitCode !== 0) throw new Error('Could not initialize the demo sandbox.');
    await sandbox.fs.uploadFiles([
      { source: Buffer.from(VULNERABLE_CODE), destination: '/tmp/patchproof/login.py' },
      { source: Buffer.from(TESTS), destination: '/tmp/patchproof/probe.py' },
    ]);
    emit({ type: 'stage', stage: 'baseline', message: 'Running the five baseline checks' });
    const before = await probe();
    emit({ type: 'baseline', before });
    const baselineExpected = before.legitimate_login_works && before.wrong_password_rejected &&
      before.unknown_user_rejected && !before.username_injection_blocked && !before.password_injection_blocked;
    if (!baselineExpected) throw new Error('Baseline differs from the expected vulnerable demo.');

    emit({ type: 'stage', stage: 'generate', message: `Asking ${model} to generate a secure patch` });
    let aiResponse;
    try {
      aiResponse = await ai.models.generateContent({ model, contents: PROMPT });
    } catch (error) {
      if (!isTemporaryOverload(error) || model === 'gemini-3.5-flash-lite') throw error;
      model = 'gemini-3.5-flash-lite';
      emit({ type: 'stage', stage: 'generate', message: 'Primary model busy. Switching to Gemini Flash Lite' });
      aiResponse = await ai.models.generateContent({ model, contents: PROMPT });
    }
    const patch = cleanPythonResponse(aiResponse);
    emit({ type: 'patch', patch, model });

    emit({ type: 'stage', stage: 'verify', message: 'Re-running unchanged tests against AI-generated patch' });
    await sandbox.fs.uploadFile(Buffer.from(patch), '/tmp/patchproof/login.py');
    const after = await probe();
    const verified = TEST_KEYS.every((key) => after[key] === true);
    const report = {
      project: 'PatchProof',
      demo: 'SQLite authentication SQL injection',
      timestamp: new Date().toISOString(),
      model,
      before,
      after,
      verified,
      originalCode: VULNERABLE_CODE,
      patchedCode: patch,
      note: 'Verification covers five predetermined checks only; it is not a comprehensive security audit.',
    };
    emit({ type: 'result', report });
    return report;
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (sandbox) {
      emit({ type: 'stage', stage: 'cleanup', message: 'Deleting Daytona sandbox' });
      try {
        await daytona.delete(sandbox, 60, true);
        emit({ type: 'cleanup', ok: true, message: 'Disposable sandbox deleted' });
      } catch (cleanupError) {
        emit({ type: 'cleanup', ok: false, message: 'Automatic cleanup failed; inspect Daytona dashboard and delete the sandbox manually.' });
        if (!failure) throw cleanupError;
      }
    }
  }
}
