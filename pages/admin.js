import { useState } from 'react';

const s = {
  page:       { fontFamily: "'Lato', sans-serif", background: '#f9f9f7', minHeight: '100vh', padding: '40px 24px', color: '#1a1a1a' },
  center:     { maxWidth: 860, margin: '0 auto' },
  heading:    { fontFamily: "'Unica One', sans-serif", fontSize: 28, margin: '0 0 4px' },
  sub:        { color: '#666', fontSize: 14, margin: '0 0 32px' },
  loginBox:   { background: '#fff', borderRadius: 12, padding: 32, maxWidth: 380, margin: '80px auto', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' },
  loginTitle: { fontFamily: "'Unica One', sans-serif", fontSize: 22, marginBottom: 8 },
  input:      { width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 15, marginBottom: 12, boxSizing: 'border-box' },
  btn:        { width: '100%', padding: '11px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 },
  card:       { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' },
  cardNum:    { fontSize: 36, fontWeight: 700, lineHeight: 1.1, margin: '4px 0 2px' },
  cardLabel:  { fontSize: 13, color: '#888' },
  section:    { background: '#fff', borderRadius: 12, padding: '24px', boxShadow: '0 1px 6px rgba(0,0,0,0.06)', marginBottom: 20 },
  sectionH:   { fontFamily: "'Unica One', sans-serif", fontSize: 17, margin: '0 0 16px' },
  row:        { display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10 },
  rowLabel:   { fontSize: 14, minWidth: 160, color: '#333' },
  bar:        { height: 10, borderRadius: 5, background: '#1a1a1a', minWidth: 2 },
  rowCount:   { fontSize: 13, color: '#888', marginLeft: 4 },
  dayRow:     { display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, marginTop: 8 },
  dayBar:     { flex: 1, background: '#1a1a1a', borderRadius: '3px 3px 0 0', minHeight: 2 },
  dayLabel:   { textAlign: 'center', fontSize: 10, color: '#aaa', marginTop: 4 },
  err:        { color: '#c00', fontSize: 14, marginBottom: 8 },
  stat2:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 },
  reportCard: { background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', marginBottom: 12 },
  reportMeta: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  reportLabel: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', marginBottom: 4 },
  reportText: { fontSize: 13, color: '#1a1a1a', background: '#f9fafb', borderRadius: 6, padding: '8px 12px', marginBottom: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
  reportTextFlag: { fontSize: 13, color: '#7f1d1d', background: '#fef2f2', borderRadius: 6, padding: '8px 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
};

export default function Dashboard() {
  const [secret, setSecret] = useState('');
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/analytics?secret=' + encodeURIComponent(secret));
      if (res.status === 401) { setError('Wrong secret.'); setLoading(false); return; }
      if (!res.ok) throw new Error('Server error');
      setData(await res.json());
    } catch {
      setError('Could not load data. Try again.');
    }
    setLoading(false);
  }

  if (!data) {
    return (
      <div style={s.page}>
        <link href="https://fonts.googleapis.com/css2?family=Unica+One&family=Lato:wght@400;700&display=swap" rel="stylesheet" />
        <div style={s.loginBox}>
          <div style={s.loginTitle}>Analytics</div>
          <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px' }}>Enter your admin secret to view usage data.</p>
          <form onSubmit={login}>
            {error && <div style={s.err}>{error}</div>}
            <input style={s.input} type="password" placeholder="Admin secret" value={secret} onChange={e => setSecret(e.target.value)} autoFocus />
            <button style={s.btn} type="submit" disabled={loading}>{loading ? 'Loading…' : 'View Dashboard'}</button>
          </form>
        </div>
      </div>
    );
  }

  const { totals, avg_session_duration_seconds, avg_messages_per_session, top_queries, by_country, us_cities, by_day, reports } = data;

  const maxDay     = Math.max(...(by_day || []).map(d => d.count), 1);
  const maxQuery   = Math.max(...(top_queries || []).map(q => q.count), 1);
  const maxCountry = Math.max(...(by_country || []).map(c => c.count), 1);
  const maxCity    = Math.max(...(us_cities  || []).map(c => c.count), 1);

  function fmtDuration(s) {
    if (!s) return '—';
    if (s < 60) return s + 's';
    return Math.round(s / 60) + 'm ' + (s % 60) + 's';
  }

  // Show last 14 days of by_day for the bar chart
  const recentDays = (by_day || []).slice(-14);

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Unica+One&family=Lato:wght@400;700&display=swap" rel="stylesheet" />
      <div style={s.center}>
        <div style={s.heading}>Changeist Analytics</div>
        <p style={s.sub}>Last 30 days · Anonymous usage only · No personal data stored</p>

        {/* Top stats */}
        <div style={{ ...s.grid, gridTemplateColumns: 'repeat(5, 1fr)' }}>
          <div style={s.card}>
            <div style={s.cardLabel}>Searches</div>
            <div style={s.cardNum}>{totals.searches.toLocaleString()}</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Chat Sessions</div>
            <div style={s.cardNum}>{totals.chat_starts.toLocaleString()}</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Avg Session Length</div>
            <div style={s.cardNum}>{fmtDuration(avg_session_duration_seconds)}</div>
          </div>
          <div style={s.card}>
            <div style={s.cardLabel}>Avg Messages / Session</div>
            <div style={s.cardNum}>{avg_messages_per_session != null ? avg_messages_per_session : '—'}</div>
          </div>
          <div style={{ ...s.card, background: reports && reports.length > 0 ? '#fff5f5' : '#fff', borderColor: reports && reports.length > 0 ? '#fecaca' : 'transparent', border: '1px solid' }}>
            <div style={s.cardLabel}>Flagged Reports</div>
            <div style={{ ...s.cardNum, color: reports && reports.length > 0 ? '#b91c1c' : '#1a1a1a' }}>{(reports || []).length}</div>
          </div>
        </div>

        {/* Activity by day */}
        {recentDays.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionH}>Activity (last {recentDays.length} days)</div>
            <div style={s.dayRow}>
              {recentDays.map(d => (
                <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ ...s.dayBar, height: Math.max(4, Math.round((d.count / maxDay) * 72)) }} title={d.count + ' events'} />
                  <div style={s.dayLabel}>{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={s.stat2}>
          {/* Top queries */}
          <div style={s.section}>
            <div style={s.sectionH}>Top Searches</div>
            {(top_queries || []).slice(0, 15).map(q => (
              <div key={q.query} style={s.row}>
                <div style={s.rowLabel}>{q.query}</div>
                <div style={{ ...s.bar, width: Math.max(4, Math.round((q.count / maxQuery) * 140)) }} />
                <div style={s.rowCount}>{q.count}</div>
              </div>
            ))}
            {(!top_queries || top_queries.length === 0) && <div style={{ color: '#aaa', fontSize: 14 }}>No data yet</div>}
          </div>

          {/* By country */}
          <div style={s.section}>
            <div style={s.sectionH}>By Country</div>
            {(by_country || []).map(c => (
              <div key={c.country} style={s.row}>
                <div style={s.rowLabel}>{c.country}</div>
                <div style={{ ...s.bar, width: Math.max(4, Math.round((c.count / maxCountry) * 140)) }} />
                <div style={s.rowCount}>{c.count}</div>
              </div>
            ))}
            {(!by_country || by_country.length === 0) && <div style={{ color: '#aaa', fontSize: 14 }}>No data yet</div>}
          </div>
        </div>

        {/* US cities */}
        {us_cities && us_cities.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionH}>US Cities</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              {us_cities.map(c => (
                <div key={c.city} style={s.row}>
                  <div style={s.rowLabel}>{c.city}</div>
                  <div style={{ ...s.bar, width: Math.max(4, Math.round((c.count / maxCity) * 140)) }} />
                  <div style={s.rowCount}>{c.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flagged reports */}
        <div style={s.section}>
          <div style={s.sectionH}>Flagged Reports {reports && reports.length > 0 ? `(${reports.length})` : ''}</div>
          {(!reports || reports.length === 0) && <div style={{ color: '#aaa', fontSize: 14 }}>No reports yet</div>}
          {(reports || []).map(r => (
            <div key={r.id} style={s.reportCard}>
              <div style={s.reportMeta}>{r.created_at ? new Date(r.created_at).toLocaleString() : ''}{r.country ? ` · ${r.country}` : ''}</div>
              <div style={s.reportLabel}>User said</div>
              <div style={s.reportText}>{r.user_message || <em style={{ color: '#aaa' }}>No user message captured</em>}</div>
              <div style={s.reportLabel}>Link responded</div>
              <div style={s.reportTextFlag}>{r.assistant_message || <em style={{ color: '#aaa' }}>No response captured</em>}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#bbb', marginTop: 8 }}>
          <button onClick={() => setData(null)} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 12 }}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
