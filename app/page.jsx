'use client';

import { useRef, useState } from 'react';

const STEPS = [
  { id: 'sandbox', name: 'Provision sandbox', detail: 'Daytona isolation' },
  { id: 'baseline', name: 'Reproduce exploit', detail: 'Before-patch tests' },
  { id: 'generate', name: 'Generate patch', detail: 'Gemini AI' },
  { id: 'verify', name: 'Verify remediation', detail: 'Same tests, unchanged' },
  { id: 'cleanup', name: 'Clean up sandbox', detail: 'Remove resources' },
];
const CHECKS = [
  ['legitimate_login_works', 'Valid credentials', 'Regression'],
  ['wrong_password_rejected', 'Invalid password rejected', 'Regression'],
  ['unknown_user_rejected', 'Unknown user rejected', 'Regression'],
  ['username_injection_blocked', 'Username SQL injection', 'Security'],
  ['password_injection_blocked', 'Password SQL injection', 'Security'],
];
const ORIGINAL_CODE = `import sqlite3

def authenticate(username, password):
    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE users (username TEXT, password TEXT)")
        conn.execute("INSERT INTO users VALUES (?, ?)", ("admin", "demo-password-123"))
        query = f"SELECT username FROM users WHERE username = '{username}' AND password = '{password}'"
        return conn.execute(query).fetchone() is not None
    finally:
        conn.close()`;

export default function Home() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [events, setEvents] = useState([]);
  const [before, setBefore] = useState(null);
  const [patch, setPatch] = useState('');
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [cleanup, setCleanup] = useState(null);
  const [accessCode, setAccessCode] = useState('');
  const busyRef = useRef(false);

  function processEvent(event) {
    if (event.type === 'stage') setStage(event.stage);
    if (event.type === 'baseline') setBefore(event.before);
    if (event.type === 'patch') setPatch(event.patch);
    if (event.type === 'result') setReport(event.report);
    if (event.type === 'error') setError(event.message);
    if (event.type === 'cleanup') setCleanup(event);
    if (event.message) setEvents((prev) => [...prev, { message: event.message, time: new Date().toLocaleTimeString() }]);
  }

  async function startScan() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setStage(''); setEvents([]); setBefore(null); setPatch(''); setReport(null); setError(''); setCleanup(null);
    let finishedReport = false;
    let sentError = false;
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'x-demo-code': accessCode },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Backend responded with HTTP ${response.status}`);
      }
      if (!response.body) throw new Error('No response stream from server.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      function consume(line) {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        processEvent(event);
        if (event.type === 'result') finishedReport = true;
        if (event.type === 'error') sentError = true;
      }
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = pending.indexOf('\n')) !== -1) {
          consume(pending.slice(0, idx));
          pending = pending.slice(idx + 1);
        }
      }
      pending += decoder.decode();
      if (pending.trim()) consume(pending);
      if (!finishedReport && !sentError) throw new Error('Scan ended without a verification result.');
    } catch (e) {
      setError(e?.message || 'Unexpected error');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function downloadReport() {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ ...report, sandboxCleanup: cleanup }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'patchproof-report.json'; a.click();
    URL.revokeObjectURL(url);
  }

  const beforeCount = before ? CHECKS.filter(([key, , type]) => type === 'Security' && !before[key]).length : 0;
  const afterCount = report ? CHECKS.filter(([key]) => report.after[key]).length : 0;
  const currentIndex = STEPS.findIndex((item) => item.id === stage);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><div className="brand-icon">P<span>✓</span></div><span>Patch<span className="brand-light">Proof</span></span></div>
        <div className="top-right"><span className="dot pulse" /> <span>Security verification lab</span><span className="version">DEMO / 01</span></div>
      </header>
      <main>
        <div className="eyebrow"><span className="eyebrow-line"/> AI-POWERED SOFTWARE SECURITY</div>
        <section className="hero">
          <div className="hero-copy">
            <h1>Don&apos;t just patch it.<br/><em>Prove it&apos;s fixed.</em></h1>
            <p>PatchProof finds reproducible vulnerabilities, generates a focused AI patch, and runs the exact same tests in a disposable cloud sandbox. No hand-waving. Just evidence.</p>
            <div className="hero-actions"><button className="primary" onClick={startScan} disabled={busy}>{busy ? <><span className="spinner"/> Running verification…</> : <>▶ &nbsp; Run live security test</>}</button><span className="run-note">Real Gemini + real Daytona · Uses free-tier credits</span></div>
            <label className="code-label">Demo access code <span>(optional locally)</span><input autoComplete="off" type="password" placeholder="Only if your deployment requires one" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} /></label>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-glow"/><div className="art-grid"/>
            <div className="art-shield">◈<div className="art-shield-small">✓</div></div>
            <div className="art-chip art-chip-top">01 · DETECT</div><div className="art-chip art-chip-bottom">03 · VERIFY</div>
          </div>
        </section>
        <div className="divider"/>
        <section className="stats">
          <div className="stat"><div className="stat-title">TARGET <span>↗</span></div><div className="stat-value smaller">SQL Injection</div><p>Python · SQLite authentication</p></div>
          <div className="stat"><div className="stat-title">VULNERABILITIES REPRODUCED <span>↗</span></div><div className={'stat-value ' + (before ? 'red' : '')}>{before ? String(beforeCount).padStart(2, '0') : '—'}</div><p>{before ? 'Both original SQL injection attacks succeed' : 'Run the test to discover the baseline'}</p></div>
          <div className="stat"><div className="stat-title">PATCH VERIFICATION <span>↗</span></div><div className={'stat-value ' + (report?.verified ? 'green' : '')}>{report ? `${afterCount}/5` : '—'}</div><p>{report ? (report.verified ? 'All five checks now pass' : 'One or more checks failed') : 'Independently tested after patching'}</p></div>
          <div className="stat"><div className="stat-title">EXECUTION ENGINE <span>↗</span></div><div className="stat-value smaller">Daytona</div><p>Ephemeral isolated sandbox</p></div>
        </section>

        <section className="content-layout">
          <div className="panel panel-steps">
            <div className="panel-header"><div><span className="section-kicker">WORKFLOW</span><h2>Verification pipeline</h2></div><span className={'pill ' + (busy ? 'working' : report?.verified ? 'verified' : 'idle')}>{busy ? '● RUNNING' : report?.verified ? '✓ VERIFIED' : error ? '✕ ERROR' : '○ READY'}</span></div>
            <div className="step-list">
              {STEPS.map((item, i) => {
                const active = stage === item.id && busy;
                const complete = (report && i < 4) || (cleanup?.ok && i === 4) || (currentIndex > i);
                return <div className={'step ' + (complete ? 'step-done' : active ? 'step-active' : '')} key={item.id}>
                  <div className="step-marker">{complete ? '✓' : String(i + 1).padStart(2, '0')}</div><div className="step-text"><strong>{item.name}</strong><small>{item.detail}</small></div><div className="step-status">{complete ? 'DONE' : active ? 'LIVE' : '—'}</div>
                </div>;
              })}
            </div>
          </div>
          <div className="panel panel-events">
            <div className="panel-header"><div><span className="section-kicker">OUTPUT</span><h2>Live execution log</h2></div><span className="small-indicator"><span className={'mini-led ' + (busy ? 'blink' : '')}/> LIVE</span></div>
            <div className="log-view">
              <div className="terminal-header"><span/><span/><span/><p>patchproof / verification-engine</p></div>
              <div className="log-lines">
                {events.length === 0 ? <div className="log-placeholder"><span>$</span> Ready to run security verification.<br/><span>$</span> No sandbox active.</div> : events.map((item,i) => <div className="log-line" key={i}><span className="log-time">{item.time}</span><span className="log-arrow">›</span><span>{item.message}</span></div>)}
                {report && <div className={'log-final ' + (report.verified ? '' : 'log-fail')}>{report.verified ? '✓ PATCH VERIFIED — all 5 checks passed' : '✕ PATCH NOT VERIFIED'}</div>}
                {error && <div className="log-error">Error: {error}</div>}
                {cleanup && <div className={'log-final ' + (!cleanup.ok ? 'log-fail' : '')}>{cleanup.ok ? '✓ Sandbox deleted' : '⚠ ' + cleanup.message}</div>}
                {busy && <div className="log-line cursor">▊</div>}
              </div>
            </div>
          </div>
        </section>

        <section className="panel results">
          <div className="panel-header"><div><span className="section-kicker">EVIDENCE</span><h2>Before vs. after</h2></div><span className="detail-note">Five unchanged tests · {report ? (report.verified ? 'Passed' : 'Failed') : 'Awaiting run'}</span></div>
          <div className="table-wrap"><table><thead><tr><th>TEST CASE</th><th>CLASS</th><th>BEFORE PATCH</th><th>AFTER PATCH</th></tr></thead><tbody>{CHECKS.map(([key,name,type])=><tr key={key}><td className="test-name">{name}</td><td><span className="type-chip">{type}</span></td><td>{before ? <span className={'test-badge ' + (before[key] ? 'test-good' : 'test-bad')}>{before[key] ? '✓ PASSED' : '✕ EXPLOIT SUCCEEDED'}</span> : <span className="test-empty">—</span>}</td><td>{report ? <span className={'test-badge ' + (report.after[key] ? 'test-good' : 'test-bad')}>{report.after[key] ? '✓ PASSED' : '✕ FAILED'}</span> : <span className="test-empty">—</span>}</td></tr>)}</tbody></table></div>
          <div className="evidence-foot"><span>Baseline failures on security tests are deliberate — they demonstrate reproducible vulnerabilities.</span>{report && <button className="secondary" onClick={downloadReport}>↓ Export proof report</button>}</div>
        </section>

        <section className="code-section"><div className="code-heading"><div><span className="section-kicker">CODE REVIEW</span><h2>The actual fix</h2></div><p>{report ? `Generated by ${report.model}` : 'Original demo source shown until an AI patch is generated'}</p></div>
          <div className="code-grid"><div className="code-pane"><div className="code-title"><span className="code-dot red-dot"/> BEFORE <span>login.py</span></div><pre><code>{ORIGINAL_CODE}</code></pre></div><div className="code-pane"><div className="code-title"><span className="code-dot green-dot"/> AFTER <span>login.py</span></div><pre><code>{patch || '# The Gemini-generated patch will appear here\n# after you run a live verification.'}</code></pre></div></div>
        </section>
        <footer><div className="footer-brand">◈ PatchProof <span>© 2026 HackHarvard demo</span></div><p>Five fixed regression checks, not a comprehensive security guarantee. Demo code only — never deploy the vulnerable fixture.</p></footer>
      </main>
    </div>
  );
}
