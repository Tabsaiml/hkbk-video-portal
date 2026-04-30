import { useState, useRef } from 'react'
import { getToken } from '../api'

export default function UploadModal({ onClose, onDone }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [desc, setDesc] = useState('')
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef()

  function pickFile(f) {
    if (!f) return
    if (!/\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name)) {
      return setError('Only video files are allowed (MP4, MOV, AVI, MKV, WebM)')
    }
    setFile(f)
    setError('')
  }

  function doUpload() {
    if (!file) return setError('Please select a video file')
    if (!title.trim()) return setError('Please enter a title')
    setError('')

    const fd = new FormData()
    fd.append('video', file)
    fd.append('title', title.trim())
    fd.append('topic', topic.trim())
    fd.append('description', desc.trim())

    setUploading(true)
    setProgress(0)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    const token = getToken()
    if (token) xhr.setRequestHeader('x-auth-token', token)

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      try {
        const res = JSON.parse(xhr.responseText)
        if (res.error) setError(res.error)
        else { onDone(); onClose() }
      } catch {
        setError('Upload failed')
      }
    }
    xhr.onerror = () => { setUploading(false); setError('Upload failed — check your connection') }
    xhr.send(fd)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !uploading && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h3>⬆️ Upload Video</h3>
          <button type="button" className="modal-close" onClick={() => !uploading && onClose()}>✕</button>
        </div>
        <div className="modal-body">
          {error && <div className="auth-error" style={{ marginBottom: 12 }}>{error}</div>}

          <div
            className={`drop-zone${dragOver ? ' drag-over' : ''}`}
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]) }}
          >
            {file ? (
              <div>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📹</div>
                <p style={{ color: '#90caf9', fontWeight: 600 }}>{file.name}</p>
                <p style={{ color: '#888', fontSize: 12, marginTop: 4 }}>{(file.size / 1048576).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📹</div>
                <p style={{ color: '#aaa' }}>Drag & drop video or <span style={{ color: '#90caf9' }}>click to browse</span></p>
                <p style={{ color: '#555', fontSize: 11, marginTop: 6 }}>MP4, MOV, AVI, MKV, WebM · Max 500 MB</p>
              </div>
            )}
          </div>
          <input type="file" ref={fileRef} accept="video/*" style={{ display: 'none' }} onChange={e => pickFile(e.target.files[0])} />

          <div className="auth-info" style={{ marginBottom: 14 }}>
            ⏳ Your video will be reviewed by admin before it becomes visible to others.
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter video title" />
          </div>
          <div className="form-group">
            <label>Topic / Category</label>
            <input type="text" value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Machine Learning, AI, DBMS" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Brief description..." rows={3} style={{ resize: 'vertical' }} />
          </div>

          {uploading && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa', marginBottom: 6 }}>
                <span>Uploading...</span><span>{progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <button type="button" className="submit-btn" onClick={doUpload} disabled={uploading}>
            {uploading ? `Uploading ${progress}%...` : 'Upload Video'}
          </button>
        </div>
      </div>
    </div>
  )
}
