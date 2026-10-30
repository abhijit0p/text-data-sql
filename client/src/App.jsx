import React, { useState } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import { Upload, Send, Database, Table as TableIcon, Sparkles } from 'lucide-react';

const API_BASE = "http://localhost:5000";

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await axios.post(`${API_BASE}/api/upload`, formData);
      setSessionId(res.data.sessionId);
      setWidgets(res.data.widgets || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunQuery = async (e) => {
    e.preventDefault();
    if (!query.trim() || !sessionId) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await axios.post(`${API_BASE}/api/query`, {
        sessionId,
        prompt: query
      });
      // Prepend newly generated widget to the front of the dashboard
      setWidgets((prev) => [res.data, ...prev]);
      setQuery('');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', backgroundColor: '#f8fafc' }}>
      {/* Top Navbar */}
      <header style={{ padding: '14px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Database size={22} color="#2563eb" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>Text + Data to SQL Prototype</h1>
          {sessionId && (
            <span style={{ fontSize: 12, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: 12 }}>
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
        <div>
          <input type="file" accept=".xlsx, .xls" onChange={handleUpload} style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#ffffff', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            <Upload size={16} /> {sessionId ? "Upload New Excel" : "Upload Excel"}
          </label>
        </div>
      </header>

      {/* Query Bar */}
      {sessionId && (
        <form onSubmit={handleRunQuery} style={{ display: 'flex', gap: 10, padding: '12px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <input
            type="text"
            placeholder="Ask a question (e.g., 'Show total sales by city as a bar chart' or 'Top 5 customers with their spend')..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
            style={{ flex: 1, padding: '10px 14px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, outline: 'none' }}
          />
          <button type="submit" disabled={loading || !query.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f172a', color: '#ffffff', padding: '0 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 500 }}>
            {loading ? <Sparkles size={16} className="animate-spin" /> : <Send size={16} />}
            {loading ? "Generating..." : "Run Query"}
          </button>
        </form>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '10px 24px', fontSize: 13 }}>
          {errorMsg}
        </div>
      )}

      {/* Main Canvas */}
      <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {!sessionId ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
            <TableIcon size={48} strokeWidth={1.5} style={{ marginBottom: 16 }} />
            <p style={{ margin: 0, fontSize: 16 }}>Upload a multi-sheet Excel file to auto-generate dashboards and execute natural language queries.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 20 }}>
            {widgets.map((w, idx) => (
              <div key={idx} style={{ background: '#ffffff', borderRadius: 8, padding: 18, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 600, color: '#1e293b' }}>
                  {w.chartConfig?.title || "Analytical Projection"}
                </h3>
                <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#64748b' }}>
                  {w.explanation}
                </p>

                {/* Chart or Table Rendering */}
                <div style={{ height: 260, width: '100%', flex: 1 }}>
                  {w.chartConfig?.recommendedType === 'bar' && w.rows?.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={w.rows}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={w.chartConfig.xAxisKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        {w.chartConfig.yAxisKeys?.map((key, i) => (
                          <Bar key={key} dataKey={key} fill={['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][i % 4]} radius={[4, 4, 0, 0]} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {w.chartConfig?.recommendedType === 'line' && w.rows?.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={w.rows}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={w.chartConfig.xAxisKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        {w.chartConfig.yAxisKeys?.map((key, i) => (
                          <Line key={key} type="monotone" dataKey={key} stroke={['#2563eb', '#059669', '#d97706'][i % 3]} strokeWidth={2} dot={{ r: 3 }} />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {(w.chartConfig?.recommendedType === 'table' || !['bar', 'line'].includes(w.chartConfig?.recommendedType)) && (
                    <div style={{ overflowX: 'auto', maxHeight: 250, border: '1px solid #f1f5f9', borderRadius: 4 }}>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ background: '#f8fafc' }}>
                          <tr>
                            {w.rows?.[0] && Object.keys(w.rows[0]).map(col => (
                              <th key={col} style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {w.rows?.slice(0, 10).map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              {Object.values(row).map((val, cIdx) => (
                                <td key={cIdx} style={{ padding: '8px 12px', color: '#334155' }}>
                                  {val !== null && val !== undefined ? String(val) : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Collapsible Executed SQL */}
                <details style={{ marginTop: 14 }}>
                  <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', userSelect: 'none' }}>
                    View Executed SQL
                  </summary>
                  <pre style={{ margin: '6px 0 0 0', background: '#0f172a', color: '#38bdf8', padding: 10, borderRadius: 6, fontSize: 11, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                    {w.sql}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}