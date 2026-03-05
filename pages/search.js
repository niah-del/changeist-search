import { useState, useCallback, useEffect } from 'react';
import Head from 'next/head';

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_EMBED_KEY || 'changeist-internal';

export default function SearchPage() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeType, setActiveType] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error

  useEffect(() => { setMounted(true); }, []);

  const doSearch = useCallback(async (q, type) => {
    if (!q.trim()) return;
    setStatus('loading');
    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&key=${encodeURIComponent(API_KEY)}${type ? `&type=${type}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.results || []);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    doSearch(query, activeType);
  };

  const handleFilterClick = (type) => {
    setActiveType(type);
    if (query) doSearch(query, type);
  };

  if (!mounted) return null;

  return (
    <>
      <Head>
        <title>Search Opportunities — Changeist</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: transparent; color: #1a1a1a; padding: 16px; }
        .form { display: flex; border: none; border-radius: 999px; overflow: hidden; background: #fff0f4; box-shadow: 7px 9px 22px rgba(210,140,160,.22), -4px -4px 12px rgba(255,255,255,.85); transition: box-shadow .2s; }
        .form:focus-within { box-shadow: 7px 9px 28px rgba(210,140,160,.32), -4px -4px 12px rgba(255,255,255,.9); }
        .input { flex: 1; padding: 14px 20px; border: none; outline: none; font-size: 16px; background: transparent; min-width: 0; }
        .input::placeholder { color: #c4a0ac; }
        .btn { padding: 0 20px; background: transparent; color: #c48098; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color .15s; }
        .btn:hover { color: #a05070; }
        .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
        .filter-btn { padding: 6px 14px; border-radius: 999px; border: 1.5px solid #d1d5db; background: transparent; color: #1a1a1a; font-size: 14px; cursor: pointer; transition: all .15s; }
        .filter-btn:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .filter-btn.active { background: #1a1a1a; border-color: #1a1a1a; color: #fff; }
        .results { margin-top: 20px; display: flex; flex-direction: column; gap: 12px; }
        .card { display: block; padding: 18px 20px; border: 1.5px solid #e5e7eb; border-radius: 12px; background: #fff; text-decoration: none; color: inherit; transition: border-color .15s, box-shadow .15s, transform .1s; }
        .card:hover { border-color: #2563eb; box-shadow: 0 4px 12px rgba(37,99,235,.1); transform: translateY(-1px); }
        .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 999px; letter-spacing: .03em; text-transform: uppercase; }
        .badge-internal { background: #fce7f0; color: #be185d; }
        .badge-sponsored { background: #fef3c7; color: #92400e; }
        .badge-web { background: #f3f4f6; color: #6b7280; }
        .type-pill { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 999px; background: #f0fdf4; color: #166534; font-weight: 500; }
        .location { font-size: 12px; color: #6b7280; margin-left: auto; }
        .card-title { margin: 0 0 4px; font-size: 17px; font-weight: 600; color: #111827; line-height: 1.3; }
        .card-org { margin: 0 0 8px; font-size: 14px; color: #6b7280; font-weight: 500; }
        .card-desc { margin: 0; font-size: 14px; color: #4b5563; line-height: 1.5; }
        .status { padding: 24px 0; color: #6b7280; font-size: 15px; display: flex; align-items: center; gap: 12px; }
        .spinner { width: 22px; height: 22px; border: 2.5px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty { padding: 24px 0; color: #6b7280; font-size: 15px; line-height: 1.6; }
        .empty a { color: #2563eb; }
        .error { padding: 16px; background: #fef2f2; color: #b91c1c; border-radius: 8px; font-size: 14px; }
        .footer { margin-top: 20px; text-align: right; }
        .powered { font-size: 12px; color: #9ca3af; text-decoration: none; }
        .powered:hover { color: #2563eb; }
        @media (max-width: 480px) { .input { padding: 12px 14px; font-size: 15px; } .btn { padding: 0 14px; } }
      `}</style>

      <form className="form" role="search" onSubmit={handleSubmit}>
        <input
          className="input"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search volunteer, job, internship, or event opportunities..."
          aria-label="Search opportunities"
          autoComplete="off"
        />
        <button className="btn" type="submit" aria-label="Search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </button>
      </form>

      <div className="filters">
        {[['', 'All'], ['volunteer', 'Volunteer'], ['job', 'Jobs'], ['internship', 'Internships'], ['event', 'Events']].map(([type, label]) => (
          <button
            key={type}
            className={`filter-btn${activeType === type ? ' active' : ''}`}
            onClick={() => handleFilterClick(type)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="results" aria-live="polite">
        {status === 'loading' && (
          <div className="status"><div className="spinner" />Searching...</div>
        )}
        {status === 'error' && (
          <div className="error">Something went wrong. Please try again.</div>
        )}
        {status === 'done' && results.length === 0 && (
          <div className="empty">
            <p>No results found for <strong>{query}</strong>.</p>
            <p>Try a different keyword, or <a href="https://changeist.org">browse all opportunities</a>.</p>
          </div>
        )}
        {status === 'done' && results.map((r, i) => (
          <a key={r.id || i} className="card" href={r.url || '#'} target="_blank" rel="noopener noreferrer">
            <div className="card-header">
              <span className={`badge badge-${r.source}`}>
                {r.source === 'internal' ? '✓ Verified' : r.source === 'sponsored' ? 'Sponsored' : 'Web'}
              </span>
              {r.type && <span className="type-pill">{r.type.charAt(0).toUpperCase() + r.type.slice(1)}</span>}
              {r.location && <span className="location">📍 {r.location}</span>}
            </div>
            <h3 className="card-title">{r.title}</h3>
            <p className="card-org">{r.organization}</p>
            {r.description && <p className="card-desc">{r.description.slice(0, 160)}{r.description.length > 160 ? '...' : ''}</p>}
          </a>
        ))}
      </div>

      <div className="footer">
        <a className="powered" href="https://changeist.org" target="_blank" rel="noopener">Powered by Changeist</a>
      </div>
    </>
  );
}
