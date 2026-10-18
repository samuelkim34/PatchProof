'use client';

import { useRef, useState } from 'react';
import './repo.css';

const steps = [
  ['clone', 'Clone repository'],
  ['inspect', 'Inspect source'],
  ['analyze', 'Find candidate flaw'],
  ['tests', 'Generate reproducible tests'],
  ['baseline', 'Reproduce vulnerability'],
  ['suite', 'Check existing unit tests'],
  ['patch', 'Generate focused patch'],
  ['verify', 'Verify unchanged tests'],
  ['cleanup', 'Delete sandbox'],
];

function testVerdict(t) {
  if (!t) return <span className="rep-muted">Not run</span>;
  return <span className={'rep-chip ' + (t.passed ? 'rep-pass' : 'rep-fail')}>{t.passed ? 'PASS' : 'FAIL'}</span>;
}
function downloadJSON(report, cleanup) {
  const blob = new Blob([JSON.stringify({ ...report, cleanup }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'patchproof-repository-report.json';
  document.body.appendChild(a);
  a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function RepoPage() {
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [demoCode, setDemoCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [visited, setVisited] = useState([]);
  const [logs, setLogs] = useState([]);
  const [finding, setFinding] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [before, setBefore] = useState(null);
  const [after, setAfter] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [cleanup, setCleanup] = useState(null);
  const busyRef = useRef(false);

  function handle(event) {
    if (event.type === 'stage') { setStage(event.stage); setVisited(prev => prev.includes(event.stage) ? prev : [...prev, event.stage]); }
    if (event.type === 'inventory') setInventory(event.inventory);
    if (event.type === 'finding') setFinding(event.finding);
    if (event.type === 'baseline') setBefore(event.before);
    if (event.type === 'after') setAfter(event.after);
    if (event.type === 'result') setReport(event.report);
    if (event.type === 'error') setError(event.message);
    if (event.type === 'cleanup') setCleanup(event);
    if (event.message) setLogs(previous => [...previous, { time: new Date().toLocaleTimeString(), message: event.message }]);
  }

  async function scan() {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    setStage(''); setVisited([]); setLogs([]); setFinding(null); setInventory(null);
    setBefore(null); setAfter(null); setReport(null); setError(''); setCleanup(null);
    let gotReport = false; let gotError = false;
    try {
      const response = await fetch('/api/repo-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-demo-code': demoCode },
        body: JSON.stringify({ repositoryUrl, authorized }),
      });
      if (!response.ok) {
        const obj = await response.json().catch(() => ({}));
        throw new Error(obj.error || `Server returned HTTP ${response.status}`);
      }
      if (!response.body) throw new Error('No streaming response from server.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      function consume(line) {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        handle(event);
        if (event.type === 'result') gotReport = true;
        if (event.type === 'error') gotError = true;
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n')) !== -1) {
          consume(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) consume(buffer);
      if (!gotReport && !gotError) throw new Error('Scan ended without a report.');
    } catch (e) { setError(e?.message || 'Unexpected failure'); }
    finally { busyRef.current = false; setBusy(false); }
  }

  const label = report?.verified ? 'VERIFIED AGAINST TESTS' : report ? report.status.replaceAll('_', ' ').toUpperCase() : error ? 'ERROR' : busy ? 'RUNNING' : 'READY';

  return (
    <div className="rep-app">
      <header className="rep-header">
        <a className="rep-logo" href="/">◆ Patch<span>Proof</span></a>
        <div className="rep-nav"><a href="/">Guided demo</a><a href="/lab">Python lab</a><a className="rep-nav-selected" href="/repo">GitHub audit</a></div>
      </header>
      <main className="rep-main">
        <div className="rep-kicker">PATCHPROOF / REPOSITORY AUDIT · EXPERIMENTAL</div>
        <div className="rep-hero"><div><h1>From repository <em>to proof.</em></h1><p>Clone a public Python project in an isolated Daytona sandbox. Gemini selects a security finding, writes a reproducible exploit test, proposes a fix, and PatchProof checks the same tests again.</p></div><div className="rep-label">PYTHON REPOSITORIES<br/>ONE FINDING PER SCAN<br/>NO AUTOMATIC PRs</div></div>
        <div className="rep-caveat"><strong>Important:</strong> This is a limited automated security experiment, not a comprehensive audit. It inspects a bounded sample of Python files; AI-generated tests can be mistaken. Only submit repositories you own or are explicitly authorized to test. Scan results and source snippets are sent to Gemini.</div>
        <div className="rep-grid">
          <section className="rep-panel">
            <div className="rep-panel-title"><span>01 / INPUT</span><h2>Repository</h2></div>
            <label className="rep-field-title" htmlFor="repo-url">Public GitHub repository URL</label>
            <input id="repo-url" className="rep-input" type="url" placeholder="https://github.com/owner/repository" value={repositoryUrl} onChange={e => setRepositoryUrl(e.target.value)} disabled={busy} />
            <p className="rep-help">Public HTTPS repositories only. Default branch. No private authentication tokens or secrets.</p>
            <label className="rep-check"><input type="checkbox" checked={authorized} onChange={e => setAuthorized(e.target.checked)} disabled={busy} /><span>I own this repository or have explicit permission to perform security testing.</span></label>
            <label className="rep-field-title" htmlFor="repo-code">Demo access code (only if configured)</label>
            <input id="repo-code" className="rep-input" type="password" autoComplete="off" value={demoCode} onChange={e => setDemoCode(e.target.value)} placeholder="Optional for local development" />
            <button className="rep-primary" disabled={busy || !authorized || !repositoryUrl.trim()} onClick={scan}>{busy ? 'Running repository audit…' : '▶ Run repository audit'}</button>
            <p className="rep-help">Each run uses Gemini free-tier requests and Daytona trial compute credits. No repo code is run on your laptop by this workflow.</p>
            {inventory && <div className="rep-summary"><div className="rep-mini-heading">SOURCE INVENTORY</div><strong>{inventory.inspected} / {inventory.totalEligiblePythonFiles}</strong><span>candidate Python files reviewed by Gemini</span>{inventory.truncated && <small>Some eligible files were excluded by the scan limit.</small>}</div>}
            {finding && <div className="rep-finding"><span className="rep-mini-heading">CANDIDATE FINDING · {finding.severity}</span><h3>{finding.category}</h3><code>{finding.path}</code><p>{finding.explanation}</p><small>{finding.exploitIdea}</small></div>}
          </section>
          <section className="rep-panel">
            <div className="rep-panel-title"><span>02 / EXECUTION</span><h2>Live audit pipeline <span className={'rep-status ' + (report?.verified ? 'rep-status-good' : '')}>{label}</span></h2></div>
            <div className="rep-steps">{steps.map(([id, name], idx) => <div className={'rep-step ' + (stage === id && busy ? 'rep-step-current' : visited.includes(id) && (id !== 'cleanup' || cleanup?.ok) ? 'rep-step-done' : '')} key={id}><span>{String(idx + 1).padStart(2, '0')}</span>{name}<span>{stage === id && busy ? 'LIVE' : visited.includes(id) && (id !== 'cleanup' || cleanup?.ok) ? '✓' : '—'}</span></div>)}</div>
            <div className="rep-console"><div className="rep-console-title">TERMINAL / DAYTONA + GEMINI</div><div className="rep-console-lines">{logs.length ? logs.map((item, i) => <div key={i}><span>{item.time}</span> › {item.message}</div>) : '$ Ready to inspect an authorized repository.'}{busy && <p>▌</p>}{error && <p className="rep-error">ERROR: {error}</p>}{cleanup && <p className={cleanup.ok ? 'rep-success' : 'rep-error'}>{cleanup.message}</p>}</div></div>
          </section>
        </div>
        {report && <section className="rep-panel rep-results">
          <div className="rep-panel-title"><span>03 / EVIDENCE</span><h2>Verification report</h2></div>
          <div className={'rep-verdict ' + (report.verified ? 'rep-verdict-success' : 'rep-verdict-warning')}><strong>{report.verified ? '✓ Targeted fix verified' : '◌ Verification incomplete'}</strong><span>{report.status.replaceAll('_', ' ')} — This does not certify the entire repository as secure.</span></div>
          <div className="rep-result-grid"><div><span>Security reproduction</span><p>Before {testVerdict(before?.tests?.test_security)} After {testVerdict(after?.tests?.test_security)}</p></div><div><span>Regression check</span><p>Before {testVerdict(before?.tests?.test_regression)} After {testVerdict(after?.tests?.test_regression)}</p></div><div><span>Existing repository tests</span><p>Before: {report.repoTestsBefore?.status || 'not run'}<br/>After: {report.repoTestsAfter?.status || 'not run'}</p></div></div>
          <button className="rep-secondary" onClick={() => downloadJSON(report, cleanup)}>↓ Download full evidence JSON</button>
          {report.diff && <div className="rep-code"><h3>Actual file changes (git diff)</h3><pre>{report.diff}</pre></div>}
          {report.generatedTests && <details className="rep-code"><summary>Show generated security and regression tests</summary><pre>{report.generatedTests}</pre></details>}
          <p className="rep-footnote">{report.limitations}</p>
        </section>}
        {error && !report && <div className="rep-error-box">{error}</div>}
      </main>
      <footer className="rep-footer">PATCHPROOF · DIGITAL TRUST · INSPECT / REPRODUCE / PATCH / VERIFY</footer>
    </div>
  );
}
