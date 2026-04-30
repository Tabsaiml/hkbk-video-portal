import { useState, useEffect } from 'react'
import { api } from '../api'

export default function StatsModal({ onClose }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api('/api/stats').then(res => { if (!res.error) setStats(res) })
  }, [])

  if (!stats) return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>📊 Statistics</h3>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
      </div>
    </div>
  )

  const topics = Array.isArray(stats.topics) ? stats.topics : []
  const maxTopic = topics.length ? Math.max(...topics.map(t => t.count)) : 1

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>📊 Statistics</h3>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="stats-grid">
            {[
              { num: stats.totalVideos || 0, label: 'Total Videos' },
              { num: stats.totalViews || 0, label: 'Total Views' },
              { num: stats.totalLikes || 0, label: 'Total Likes' },
              { num: stats.recentCount || 0, label: 'Recent Uploads' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-num">{s.num}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div>
              <h4 style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>🏆 Top Videos</h4>
              <table className="stats-table">
                <thead><tr><th>Title</th><th>Views</th><th>Likes</th></tr></thead>
                <tbody>
                  {(stats.topVideos || []).slice(0, 5).map(v => (
                    <tr key={v._id}>
                      <td style={{ color: '#fff', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.title}>{v.title}</td>
                      <td style={{ color: '#90caf9' }}>{v.views || 0}</td>
                      <td style={{ color: '#ef9a9a' }}>{v.likes || 0}</td>
                    </tr>
                  ))}
                  {!(stats.topVideos?.length) && <tr><td colSpan={3} style={{ color: '#555', textAlign: 'center' }}>No data</td></tr>}
                </tbody>
              </table>
            </div>
            <div>
              <h4 style={{ color: '#aaa', fontSize: 13, marginBottom: 10 }}>👤 Top Uploaders</h4>
              <table className="stats-table">
                <thead><tr><th>Name</th><th>Videos</th></tr></thead>
                <tbody>
                  {(stats.topUploaders || []).slice(0, 5).map((u, i) => (
                    <tr key={i}>
                      <td style={{ color: '#fff' }}>{u.name}</td>
                      <td style={{ color: '#90caf9' }}>{u.videos || u.count || 0}</td>
                    </tr>
                  ))}
                  {!(stats.topUploaders?.length) && <tr><td colSpan={2} style={{ color: '#555', textAlign: 'center' }}>No data</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {topics.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ color: '#aaa', fontSize: 13, marginBottom: 12 }}>📚 Topics Breakdown</h4>
              {topics.slice(0, 10).map(t => (
                <div key={t.name} className="topic-bar-wrap">
                  <div className="topic-bar-label"><span>{t.name}</span><span>{t.count}</span></div>
                  <div className="topic-bar" style={{ width: `${Math.max(4, (t.count / maxTopic * 100)).toFixed(0)}%` }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
