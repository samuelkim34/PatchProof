import { GoogleGenAI } from '@google/genai';
import { Daytona } from '@daytona/sdk';
import { mkdir, writeFile } from 'node:fs/promises';

// Intentionally vulnerable demonstration code: never deploy it.
const vulnerableCode = `import sqlite3

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

const tests = `import json
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

let model = process.env.PATCHPROOF_MODEL || 'gemini-3.6-flash';
if (!process.env.GEMINI_API_KEY || !process.env.DAYTONA_API_KEY) {
  throw new Error('Missing Gemini or Daytona key. Run with --env-file=.env');
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const daytona = new Daytona();
let sandbox;

async function probe() {
  const result = await sandbox.process.executeCommand('python3 probe.py', '/tmp/patchproof', undefined, 30);
  if (result.exitCode !== 0) throw new Error(`Security tests failed to execute: ${result.result}`);
  return JSON.parse(result.result.trim());
}

try {
  console.log('[1/5] Creating Daytona sandbox...');
  sandbox = await daytona.create({ language: 'python', ephemeral: true, autoStopInterval: 5 });
  const setup = await sandbox.process.executeCommand('mkdir -p /tmp/patchproof');
  if (setup.exitCode !== 0) throw new Error(setup.result);
  await sandbox.fs.uploadFiles([
    { source: Buffer.from(vulnerableCode), destination: '/tmp/patchproof/login.py' },
    { source: Buffer.from(tests), destination: '/tmp/patchproof/probe.py' },
  ]);

  console.log('[2/5] Testing vulnerable code...');
  const before = await probe();
  console.log('BEFORE:', before);
  if (before.legitimate_login_works !== true ||
      before.wrong_password_rejected !== true ||
      before.unknown_user_rejected !== true ||
      before.username_injection_blocked !== false ||
      before.password_injection_blocked !== false) {
    throw new Error('Baseline results differ from expectation; stopping.');
  }

  console.log(`[3/5] Requesting a fix from ${model}...`);
  const prompt = `Repair SQL injection in this deliberately vulnerable Python SQLite demo. Return the complete corrected Python file, with no commentary. Use SQL placeholders and bound parameters, keep the authenticate(username, password) function and the same in-memory demo database and user. Do not remove login checks or special-case attacks.\n\n${vulnerableCode}`;
  let result;
  try {
    result = await ai.models.generateContent({ model, contents: prompt });
  } catch (error) {
    // Only fall back on temporary service unavailability, not auth or quota errors.
    const temporarilyUnavailable =
      error?.status === 503 ||
      error?.code === 503 ||
      /"code"\s*:\s*503|"status"\s*:\s*"UNAVAILABLE"|high demand/i.test(String(error?.message ?? ''));
    if (!temporarilyUnavailable || model === 'gemini-3.5-flash-lite') throw error;
    console.log(`[3/5] ${model} is overloaded. Trying gemini-3.5-flash-lite instead...`);
    model = 'gemini-3.5-flash-lite';
    result = await ai.models.generateContent({ model, contents: prompt });
  }
  let patch = (result.text ?? '').trim();
  const fence = patch.match(/^```(?:python)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) patch = fence[1].trim();
  if (!patch.includes('def authenticate(')) throw new Error('AI returned no valid-looking authenticate function.');

  console.log('[4/5] Testing patched code with unchanged tests...');
  await sandbox.fs.uploadFile(Buffer.from(patch + '\n'), '/tmp/patchproof/login.py');
  const after = await probe();
  console.log('AFTER:', after);
  const verified = Object.keys(before).length === 5 &&
    Object.keys(after).length === 5 &&
    Object.values(after).every(value => value === true);

  await mkdir('reports', { recursive: true });
  await writeFile('reports/patched-login.py', patch + '\n');
  await writeFile('reports/last-run.json', JSON.stringify({ model, before, after, verified }, null, 2) + '\n');
  console.log('[5/5]', verified ? 'PATCH VERIFIED' : 'PATCH NOT VERIFIED');
  if (!verified) process.exitCode = 1;
} catch (error) {
  console.error('PatchProof failed:', error.message);
  process.exitCode = 1;
} finally {
  if (sandbox) {
    try {
      await daytona.delete(sandbox, 60, true);
      console.log('Daytona sandbox deleted.');
    } catch (error) {
      console.error('Sandbox cleanup failed:', error.message);
      process.exitCode = 1;
    }
  }
}
