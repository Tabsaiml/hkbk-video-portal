import { useState, useEffect, useCallback, useRef } from 'react'
import { api, getToken, setToken, clearToken } from './api'
import Auth from './components/Auth'
import Header from './components/Header'
import Videos from './components/Videos'
import UploadModal from './components/UploadModal'
import WatchModal from './components/WatchModal'
import StatsModal from './components/StatsModal'
import AdminPanel from './components/AdminPanel'

export default function App() {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (getToken()) {
      api('/api/me').then(res => {
        if (res && !res.error) setUser(res)
        else clearToken()
        setReady(true)
      })
    } else {
      setReady(true)
    }
  }, [])

  function onLogin(token, userData) {
    setToken(token)
    setUser({ canUpload: true, userType: 'faculty', ...userData })
  }

  function onLogout() {
    api('/api/logout', 'POST')
    clearToken()
    setUser(null)
  }

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ color: '#888', fontSize: 18 }}>Loading...</div>
    </div>
  )

  if (!user) return <Auth onLogin={onLogin} />
  return <MainApp user={user} onLogout={onLogout} />
}

function MainApp({ user, onLogout }) {
  const [videos, setVideos] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState('')
  const [searchType, setSearchType] = useState('all')
  const [sort, setSort] = useState('newest')
  const [modal, setModal] = useState(null)
  const [watchVideo, setWatchVideo] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)

  function showToast(msg, isErr = false) {
    setToast({ msg, isErr })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  const loadVideos = useCallback(async (pg, q, type, sortBy) => {
    const url = q
      ? `/api/search?q=${encodeURIComponent(q)}&type=${type}&page=${pg}&limit=12`
      : `/api/videos?page=${pg}&limit=12&sort=${sortBy}`
    const res = await api(url)
    if (res.error) return
    const vids = res.videos || []
    setVideos(prev => pg === 1 ? vids : [...prev, ...vids])
    setHasMore(res.hasMore || false)
    setPage(pg)
  }, [])

  async function checkPending() {
    if (user.role !== 'admin') return
    const [vRes, uRes] = await Promise.all([api('/api/pending'), api('/api/users/pending')])
    setPendingCount((vRes.videos?.length || 0) + (uRes.users?.length || 0))
  }

  useEffect(() => { loadVideos(1, search, searchType, sort) }, [sort])
  useEffect(() => { if (user.role === 'admin') checkPending() }, [])

  function doSearch(q, type) {
    setSearch(q); setSearchType(type)
    loadVideos(1, q, type, sort)
  }

  async function handleLike(id) {
    const res = await api(`/api/videos/${id}/like`, 'POST')
    if (!res.error) setVideos(prev => prev.map(v => v._id === id ? { ...v, likes: res.likes } : v))
  }

  async function handleDelete(id) {
    if (!confirm('Delete this video?')) return
    const res = await api(`/api/videos/${id}`, 'DELETE')
    if (res.success) {
      setVideos(prev => prev.filter(v => v._id !== id))
      if (modal === 'watch') setModal(null)
      showToast('Video deleted')
    } else showToast(res.error || 'Delete failed', true)
  }

  async function openWatch(video) {
    const res = await api(`/api/videos/${video._id}`)
    if (!res.error) {
      setVideos(prev => prev.map(v => v._id === video._id ? { ...v, views: res.views } : v))
      setWatchVideo(res)
      setModal('watch')
    }
  }

  async function handleApprove(id) {
    await api(`/api/videos/${id}/approve`, 'POST')
    loadVideos(1, search, searchType, sort)
    checkPending()
  }

  async function handleReject(id) {
    await api(`/api/videos/${id}/reject`, 'POST')
    setVideos(prev => prev.filter(v => v._id !== id))
    checkPending()
  }

  return (
    <div>
      <Header
        user={user}
        pendingCount={pendingCount}
        sort={sort}
        onSort={s => setSort(s)}
        onSearch={doSearch}
        onUpload={() => setModal('upload')}
        onStats={() => setModal('stats')}
        onAdmin={() => setModal('admin')}
        onLogout={onLogout}
      />
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 16px' }}>
        <Videos
          videos={videos}
          user={user}
          onWatch={openWatch}
          onLike={handleLike}
          onDelete={handleDelete}
          onApprove={handleApprove}
          onReject={handleReject}
        />
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => loadVideos(page + 1, search, searchType, sort)}
              style={{ padding: '10px 32px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {modal === 'upload' && (
        <UploadModal
          onClose={() => setModal(null)}
          onDone={() => { loadVideos(1, '', '', sort); showToast('Video uploaded! Awaiting admin review.') }}
        />
      )}
      {modal === 'watch' && watchVideo && (
        <WatchModal
          video={watchVideo}
          user={user}
          onClose={() => setModal(null)}
          onLike={handleLike}
          onDelete={handleDelete}
        />
      )}
      {modal === 'stats' && <StatsModal onClose={() => setModal(null)} />}
      {modal === 'admin' && (
        <AdminPanel
          onClose={() => {
            setModal(null)
            checkPending()
            loadVideos(1, search, searchType, sort)
          }}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.isErr ? '#c62828' : '#1b5e20',
          color: '#fff', padding: '12px 20px', borderRadius: 8,
          fontSize: 14, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.4)'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
