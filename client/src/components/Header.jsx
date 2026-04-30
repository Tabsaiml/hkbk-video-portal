import { useState } from 'react'

export default function Header({ user, pendingCount, sort, onSort, onSearch, onUpload, onStats, onAdmin, onLogout }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')

  function doSearch(e) {
    e.preventDefault()
    onSearch(q, type)
  }

  function clearSearch() {
    setQ('')
    onSearch('', 'all')
  }

  return (
    <div className="header">
      <div className="header-logo">🎬 HKBK Video Library</div>

      <form onSubmit={doSearch} className="search-wrap">
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search videos..."
        />
        <select value={type} onChange={e => setType(e.target.value)}>
          <option value="all">All</option>
          <option value="title">Title</option>
          <option value="topic">Topic</option>
          <option value="person">Person</option>
        </select>
        <button type="submit" style={{ padding: '7px 10px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>🔍</button>
        {q && <button type="button" onClick={clearSearch} style={{ padding: '7px 8px', background: '#2a2a2a', color: '#aaa', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>✕</button>}
      </form>

      <div className="sort-tabs">
        {[{ key: 'newest', label: 'Newest' }, { key: 'views', label: 'Most Viewed' }, { key: 'all', label: 'All' }].map(s => (
          <button key={s.key} type="button" className={`sort-tab${sort === s.key ? ' active' : ''}`} onClick={() => onSort(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="header-right">
        <div className="user-chip">
          {user.name} · <span className="user-role">{user.role.toUpperCase()}</span>
        </div>
        {user.canUpload !== false && (
          <button type="button" className="hbtn upload" onClick={onUpload}>⬆️ Upload</button>
        )}
        {user.role === 'admin' && (
          <>
            <button type="button" className="hbtn outline" onClick={onStats}>📊 Stats</button>
            <button type="button" className="hbtn admin-btn" onClick={onAdmin}>
              ⚙️ Admin {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
            </button>
          </>
        )}
        <button type="button" className="hbtn outline" onClick={onLogout}>Logout</button>
      </div>
    </div>
  )
}
