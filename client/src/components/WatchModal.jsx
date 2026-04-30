import { useState, useEffect } from 'react'
import { getToken, api } from '../api'

function fmt(n) { if (!n) return '0'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1000) return (n/1000).toFixed(1)+'K'; return String(n) }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }

export default function WatchModal({ video: initialVideo, user, onClose, onLike, onDelete }) {
  const token = getToken()
  const [video, setVideo] = useState(initialVideo)
  const [sideVideos, setSideVideos] = useState([])
  const [liked, setLiked] = useState(false)

  useEffect(() => {
    // Load video list for sidebar
    api('/api/videos?page=1&limit=30&sort=newest').then(res => {
      if (!res.error) setSideVideos(res.videos || [])
    })
  }, [])

  async function switchVideo(v) {
    const res = await api(`/api/videos/${v._id}`)
    if (!res.error) setVideo(res)
    setLiked(false)
  }

  async function handleLike() {
    const res = await api(`/api/videos/${video._id}/like`, 'POST')
    if (!res.error) {
      setVideo(prev => ({ ...prev, likes: res.likes }))
      setLiked(true)
      onLike(video._id)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 1000,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        background: '#111', borderBottom: '1px solid #222', flexShrink: 0
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '2px 6px' }}
          title="Back"
        >
          ←
        </button>
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {video.title}
        </span>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: Player + Details ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Video player */}
          <div style={{ background: '#000', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
            <video
              key={video.filename}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '60vh', display: 'block' }}
              src={`/stream/${video.filename}?token=${token}`}
            />
          </div>

          {/* Title */}
          <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
            {video.title}
          </h2>

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: '#1565c0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 16
              }}>
                {(video.uploader || video.uploaderName || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{video.uploader || video.uploaderName}</div>
                <div style={{ color: '#888', fontSize: 12 }}>{fmtDate(video.uploadedAt || video.createdAt)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {video.topic && (
                <span style={{ background: '#1a237e', color: '#90caf9', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {video.topic}
                </span>
              )}
            </div>
          </div>

          {/* Stats + Actions */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
            borderTop: '1px solid #2a2a2a', borderBottom: '1px solid #2a2a2a', marginBottom: 14
          }}>
            <span style={{ color: '#aaa', fontSize: 13 }}>👁 {fmt(video.views)} views</span>
            <button
              type="button"
              onClick={handleLike}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 16px', borderRadius: 20,
                background: liked ? '#1565c0' : '#1a1a1a',
                border: '1px solid ' + (liked ? '#1565c0' : '#333'),
                color: liked ? '#fff' : '#aaa', cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}
            >
              ❤️ {fmt(video.likes)} Like{video.likes !== 1 ? 's' : ''}
            </button>
            {user.role === 'admin' && (
              <button
                type="button"
                onClick={() => { onDelete(video._id); onClose() }}
                style={{ padding: '6px 14px', borderRadius: 20, background: '#1a1a1a', border: '1px solid #333', color: '#ef9a9a', cursor: 'pointer', fontSize: 13 }}
              >
                🗑 Delete
              </button>
            )}
          </div>

          {/* Description */}
          {video.description && (
            <div style={{ background: '#161616', borderRadius: 8, padding: '14px 16px' }}>
              <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{video.description}</p>
            </div>
          )}
        </div>

        {/* ── RIGHT: Video List ── */}
        <div style={{
          width: 360, flexShrink: 0, overflowY: 'auto',
          borderLeft: '1px solid #1e1e1e', padding: '12px 12px',
          background: '#0f0f0f'
        }}>
          <p style={{ color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 10, paddingLeft: 4 }}>UP NEXT</p>
          {sideVideos.filter(v => v._id !== video._id).map(v => (
            <SideCard key={v._id} video={v} active={v._id === video._id} onClick={() => switchVideo(v)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function SideCard({ video, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', gap: 10, padding: '8px 6px', borderRadius: 8, cursor: 'pointer', marginBottom: 4,
        background: active ? '#1a237e' : 'transparent',
        transition: 'background .15s'
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#1a1a1a' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 120, height: 68, flexShrink: 0, background: '#1a1a1a',
        borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26, overflow: 'hidden', position: 'relative'
      }}>
        🎬
        {video.topic && (
          <div style={{
            position: 'absolute', bottom: 4, left: 4,
            background: '#1565c0', color: '#fff', fontSize: 9, padding: '1px 5px',
            borderRadius: 3, fontWeight: 700
          }}>
            {video.topic}
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{
          color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical'
        }}>
          {video.title}
        </div>
        <div style={{ color: '#888', fontSize: 11, marginTop: 4 }}>{video.uploader || video.uploaderName}</div>
        <div style={{ color: '#666', fontSize: 11 }}>👁 {video.views || 0}</div>
      </div>
    </div>
  )
}
