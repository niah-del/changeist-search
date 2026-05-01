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

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthOptions() {
  const now = new Date();
  const options = [];
  // Go back 12 months from current
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return options;
}

export default function Dashboard() {
  const now = new Date();
  const [secret, setSecret] = useState('');
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());

  async function fetchData(m, y) {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/analytics?secret=${encodeURIComponent(secret)}&month=${m}&year=${y}`);
      if (res.status === 401) { setError('Wrong secret.'); setLoading(false); return; }
      if (!res.ok) throw new Error('Server error');
      setData(await res.json());
    } catch {
      setError('Could not load data. Try again.');
    }
    setLoading(false);
  }

  async function login(e) {
    e.preventDefault();
    fetchData(month, year);
  }

  async function changeMonth(e) {
    const [y, m] = e.target.value.split('-').map(Number);
    setMonth(m);
    setYear(y);
    fetchData(m, y);
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

  const { totals, avg_session_duration_seconds, avg_messages_per_session, top_queries, age_distribution, by_opportunity_type, by_country, by_region, us_cities, by_day, reports } = data;

  const maxDay     = Math.max(...(by_day || []).map(d => d.count), 1);
  const maxQuery   = Math.max(...(top_queries || []).map(q => q.count), 1);
  const maxCountry = Math.max(...(by_country || []).map(c => c.count), 1);
  const maxCity    = Math.max(...(us_cities  || []).map(c => c.count), 1);
  const maxAge     = Math.max(...(age_distribution || []).map(a => a.count), 1);
  const maxOppType = Math.max(...(by_opportunity_type || []).map(o => o.count), 1);
  const maxRegion  = Math.max(...(by_region || []).map(r => r.count), 1);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={s.heading}>Changeist Analytics</div>
          <select
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={changeMonth}
            disabled={loading}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 14, cursor: 'pointer' }}
          >
            {monthOptions().map(o => {
              const val = `${o.year}-${String(o.month).padStart(2, '0')}`;
              return <option key={val} value={val}>{MONTH_NAMES[o.month - 1]} {o.year}</option>;
            })}
          </select>
        </div>
        <p style={s.sub}>{MONTH_NAMES[month - 1]} {year} · Anonymous usage only · No personal data stored</p>

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

        {/* Age distribution */}
        <div style={s.section}>
          <div style={s.sectionH}>Age Distribution <span style={{ fontFamily: 'Lato, sans-serif', fontSize: 12, fontWeight: 400, color: '#aaa' }}>(self-reported in chat)</span></div>
          {(age_distribution || []).every(a => a.count === 0)
            ? <div style={{ color: '#aaa', fontSize: 14 }}>No data yet</div>
            : <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {(age_distribution || []).map(a => (
                  <div key={a.range} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 12, color: '#888' }}>{a.count}</div>
                    <div style={{ width: 48, background: '#1a1a1a', borderRadius: '4px 4px 0 0', height: Math.max(4, Math.round((a.count / maxAge) * 80)) }} />
                    <div style={{ fontSize: 12, color: '#666' }}>{a.range}</div>
                  </div>
                ))}
              </div>
          }
        </div>

        {/* Opportunity type distribution */}
        <div style={s.section}>
          <div style={s.sectionH}>Searches by Opportunity Type</div>
          {(!by_opportunity_type || by_opportunity_type.length === 0)
            ? <div style={{ color: '#aaa', fontSize: 14 }}>No data yet</div>
            : (by_opportunity_type || []).map(o => (
              <div key={o.type} style={s.row}>
                <div style={s.rowLabel}>{o.type.charAt(0).toUpperCase() + o.type.slice(1)}</div>
                <div style={{ ...s.bar, width: Math.max(4, Math.round((o.count / maxOppType) * 140)) }} />
                <div style={s.rowCount}>{o.count}</div>
              </div>
            ))
          }
        </div>

        {/* By region */}
        {by_region && by_region.length > 0 && (
          <div style={s.section}>
            <div style={s.sectionH}>By Region / State</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
              {by_region.map(r => (
                <div key={r.region} style={s.row}>
                  <div style={s.rowLabel}>{r.region}</div>
                  <div style={{ ...s.bar, width: Math.max(4, Math.round((r.count / maxRegion) * 140)) }} />
                  <div style={s.rowCount}>{r.count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

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
