import { useState, useEffect } from 'react'
import { api } from '../api'

function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

export default function AdminPanel({ onClose }) {
  const [tab, setTab] = useState('pending')
  const [pendingVideos, setPendingVideos] = useState([])
  const [pendingUsers, setPendingUsers] = useState([])
  const [userStats, setUserStats] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { load(tab) }, [tab])

  async function load(t) {
    setLoading(true)
    if (t === 'pending') {
      const res = await api('/api/pending')
      if (!res.error) setPendingVideos(res.videos || [])
    } else if (t === 'pending-users') {
      const res = await api('/api/users/pending')
      if (!res.error) setPendingUsers(res.users || [])
    } else if (t === 'user-stats') {
      const res = await api('/api/user-stats')
      if (!res.error) setUserStats(res.stats || [])
    } else if (t === 'users') {
      const res = await api('/api/users')
      if (!res.error) setAllUsers(res.users || [])
    }
    setLoading(false)
  }

  async function approveVideo(id) {
    await api(`/api/videos/${id}/approve`, 'POST')
    setPendingVideos(p => p.filter(v => v._id !== id))
  }

  async function rejectVideo(id) {
    await api(`/api/videos/${id}/reject`, 'POST')
    setPendingVideos(p => p.filter(v => v._id !== id))
  }

  async function approveUser(id) {
    await api(`/api/users/${id}/approve`, 'POST')
    setPendingUsers(p => p.filter(u => u._id !== id))
  }

  async function rejectUser(id) {
    if (!confirm('Reject and remove this user?')) return
    await api(`/api/users/${id}`, 'DELETE')
    setPendingUsers(p => p.filter(u => u._id !== id))
  }

  async function deleteUser(id) {
    if (!confirm('Remove this user permanently?')) return
    await api(`/api/users/${id}`, 'DELETE')
    setAllUsers(p => p.filter(u => u._id !== id))
  }

  const tabs = [
    { key: 'pending', label: `⏳ Pending Videos${pendingVideos.length ? ` (${pendingVideos.length})` : ''}` },
    { key: 'pending-users', label: `👤 Pending Users${pendingUsers.length ? ` (${pendingUsers.length})` : ''}` },
    { key: 'user-stats', label: '📊 Upload Stats' },
    { key: 'users', label: '👥 All Users' },
  ]

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-wide">
        <div className="modal-header">
          <h3>⚙️ Admin Panel</h3>
          <button type="button" className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="a-tabs">
            {tabs.map(t => (
              <button key={t.key} type="button" className={`a-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {loading && <div style={{ textAlign: 'center', padding: 30, color: '#888' }}>Loading...</div>}

          {/* Pending Videos */}
          {!loading && tab === 'pending' && (
            <div>
              {pendingVideos.length === 0
                ? <div className="empty-state"><div className="icon">✅</div><p>No pending videos</p></div>
                : pendingVideos.map(v => (
                  <div key={v._id} className="pending-card">
                    <h4>{v.title}</h4>
                    <p>By {v.uploader || v.uploaderName} · {v.topic || 'No topic'} · {fmtDate(v.uploadedAt || v.createdAt)}</p>
                    {v.description && <p style={{ color: '#aaa', marginBottom: 10 }}>{v.description}</p>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-sm btn-approve" onClick={() => approveVideo(v._id)}>✓ Approve</button>
                      <button type="button" className="btn-sm btn-reject" onClick={() => rejectVideo(v._id)}>✗ Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Pending Users */}
          {!loading && tab === 'pending-users' && (
            <div>
              {pendingUsers.length === 0
                ? <div className="empty-state"><div className="icon">✅</div><p>No pending users</p></div>
                : pendingUsers.map(u => (
                  <div key={u._id} className="pending-card">
                    <h4>{u.name}</h4>
                    <p>{u.email} · <b style={{ color: u.userType === 'student' ? '#ffa726' : '#81c784' }}>{u.userType || 'faculty'}</b> · Registered {fmtDate(u.createdAt)}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-sm btn-approve" onClick={() => approveUser(u._id)}>✓ Approve</button>
                      <button type="button" className="btn-sm btn-reject" onClick={() => rejectUser(u._id)}>✗ Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {/* Upload Stats */}
          {!loading && tab === 'user-stats' && (
            <div>
              {userStats.length === 0
                ? <div className="empty-state"><div className="icon">📊</div><p>No upload data yet</p></div>
                : userStats.map(u => (
                  <div key={u._id} className="pending-card">
                    <h4 style={{ marginBottom: 2 }}>{u.name}</h4>
                    <p style={{ marginBottom: 8 }}>{u.email} · <b style={{ color: '#90caf9' }}>{u.videos.length} video{u.videos.length !== 1 ? 's' : ''}</b></p>
                    {u.videos.map(v => (
                      <div key={v._id} style={{ background: '#111', borderRadius: 6, padding: '8px 12px', marginTop: 6, fontSize: 12 }}>
                        <div style={{ color: '#fff', fontWeight: 600 }}>{v.title}</div>
                        <div style={{ color: '#888', marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>{fmtDate(v.uploadedAt || v.createdAt)}</span>
                          <span>👁 {v.views || 0}</span>
                          <span>❤️ {v.likes || 0}</span>
                          <span style={{ color: v.status === 'approved' ? '#81c784' : '#ffa726' }}>● {v.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              }
            </div>
          )}

          {/* All Users */}
          {!loading && tab === 'users' && (
            <div style={{ overflowX: 'auto' }}>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u._id}>
                      <td style={{ color: '#fff', fontWeight: 600 }}>{u.name}</td>
                      <td style={{ color: '#aaa' }}>{u.email}</td>
                      <td><span style={{ color: '#90caf9' }}>{u.userType || u.role}</span></td>
                      <td>
                        <span style={{ color: (u.status === 'approved' || u.role === 'admin') ? '#81c784' : '#ffa726' }}>
                          {u.role === 'admin' ? 'admin' : (u.status || 'approved')}
                        </span>
                      </td>
                      <td style={{ color: '#666', fontSize: 11 }}>{fmtDate(u.createdAt)}</td>
                      <td>
                        {u.role !== 'admin' && (
                          <button type="button" className="btn-sm btn-delete" onClick={() => deleteUser(u._id)}>🗑</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
