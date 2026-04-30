function fmt(n) {
  if (!n) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Videos({ videos, user, onWatch, onLike, onDelete, onApprove, onReject }) {
  if (!videos.length) return (
    <div className="empty-state">
      <div className="icon">🎬</div>
      <p>No videos found</p>
    </div>
  )

  return (
    <div className="video-grid">
      {videos.map(v => (
        <VideoCard
          key={v._id}
          video={v}
          user={user}
          onWatch={onWatch}
          onLike={onLike}
          onDelete={onDelete}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  )
}

function VideoCard({ video, user, onWatch, onLike, onDelete, onApprove, onReject }) {
  const isPending = video.status === 'pending'

  return (
    <div className="video-card">
      <div className="video-thumb" onClick={() => !isPending && onWatch(video)}>
        <div className="video-thumb-icon">🎬</div>
        {video.topic && <div className="topic-badge">{video.topic}</div>}
        {isPending && <div className="pending-overlay">⏳ Pending Review</div>}
      </div>
      <div className="video-info">
        <div className="video-title" title={video.title}>{video.title}</div>
        <div className="video-meta">{video.uploader || video.uploaderName} · {fmtDate(video.uploadedAt || video.createdAt)}</div>
        <div className="video-stats">
          <span>👁 {fmt(video.views)}</span>
          <button
            type="button"
            className="btn-sm btn-like"
            onClick={e => { e.stopPropagation(); onLike(video._id) }}
          >
            ❤️ {fmt(video.likes)}
          </button>
        </div>
        {user.role === 'admin' && (
          <div className="video-actions">
            {isPending && (
              <>
                <button type="button" className="btn-sm btn-approve" onClick={() => onApprove(video._id)}>✓ Approve</button>
                <button type="button" className="btn-sm btn-reject" onClick={() => onReject(video._id)}>✗ Reject</button>
              </>
            )}
            <button type="button" className="btn-sm btn-delete" onClick={() => onDelete(video._id)}>🗑 Delete</button>
          </div>
        )}
      </div>
    </div>
  )
}
