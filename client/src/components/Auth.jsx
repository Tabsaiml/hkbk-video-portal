import { useState } from 'react'
import { api } from '../api'

export default function Auth({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [error, setError] = useState('')

  // Login
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // Register
  const [step, setStep] = useState(1)
  const [regName, setRegName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPass, setRegPass] = useState('')
  const [otp, setOtp] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [regDone, setRegDone] = useState(false)

  function switchTab(t) { setTab(t); setError('') }

  async function doLogin() {
    setError('')
    if (!loginEmail || !loginPass) return setError('Enter email and password')
    setLoggingIn(true)
    const res = await api('/api/login', 'POST', { email: loginEmail, password: loginPass })
    setLoggingIn(false)
    if (res.error) return setError(res.error)
    onLogin(res.token, res.user)
  }

  async function sendOTP() {
    setError('')
    if (!regName.trim() || !regEmail.trim() || !regPass) return setError('All fields required')
    if (!regEmail.toLowerCase().endsWith('@hkbk.edu.in')) return setError('Only @hkbk.edu.in emails are allowed')
    if (regPass.length < 6) return setError('Password must be at least 6 characters')
    setSending(true)
    const res = await api('/api/send-otp', 'POST', { name: regName.trim(), email: regEmail.trim(), password: regPass })
    setSending(false)
    if (res.error) return setError(res.error)
    setStep(2)
    setError('')
  }

  async function verifyOTP() {
    setError('')
    if (!otp || otp.length !== 6) return setError('Enter the 6-digit code')
    setVerifying(true)
    const res = await api('/api/verify-otp', 'POST', { email: regEmail.trim(), otp })
    setVerifying(false)
    if (res.error) return setError(res.error)
    setRegDone(true)
    setError('')
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-logo">
          <h1>🎬 HKBK Video Library</h1>
          <p>HKBK Group of Institutions</p>
        </div>

        <div className="auth-tabs">
          <button type="button" className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>Login</button>
          <button type="button" className={`auth-tab${tab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>Register</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {/* ── LOGIN ── */}
        {tab === 'login' && (
          <div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="text"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="your@email.com"
                onKeyDown={e => e.key === 'Enter' && doLogin()}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={e => setLoginPass(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && doLogin()}
              />
            </div>
            <button type="button" className="auth-btn" onClick={doLogin} disabled={loggingIn}>
              {loggingIn ? 'Logging in...' : 'Login'}
            </button>
          </div>
        )}

        {/* ── REGISTER STEP 1 ── */}
        {tab === 'register' && !regDone && step === 1 && (
          <div>
            <div className="auth-info">📧 Only <b>@hkbk.edu.in</b> email addresses are allowed</div>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={regName} onChange={e => setRegName(e.target.value)} placeholder="e.g. Dr. Tabassum Ara" />
            </div>
            <div className="form-group">
              <label>HKBK Email</label>
              <input type="text" value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="yourname@hkbk.edu.in" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={regPass} onChange={e => setRegPass(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <button type="button" className="auth-btn" onClick={sendOTP} disabled={sending}>
              {sending ? 'Sending code...' : 'Send Verification Code'}
            </button>
          </div>
        )}

        {/* ── REGISTER STEP 2 ── */}
        {tab === 'register' && !regDone && step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📧</div>
              <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.6 }}>
                Verification code sent to<br />
                <b style={{ color: '#fff' }}>{regEmail}</b>
              </p>
              <p style={{ color: '#ffa726', fontSize: 12, marginTop: 6 }}>
                ⚠️ Check terminal for OTP if email fails
              </p>
            </div>
            <div className="form-group">
              <label>Enter 6-Digit Code</label>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 10, fontWeight: 700 }}
                onKeyDown={e => e.key === 'Enter' && verifyOTP()}
              />
            </div>
            <button type="button" className="auth-btn" onClick={verifyOTP} disabled={verifying}>
              {verifying ? 'Verifying...' : 'Verify & Create Account'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setOtp(''); setError('') }}
              style={{ width: '100%', background: 'none', border: 'none', color: '#888', fontSize: 12, marginTop: 12, cursor: 'pointer' }}
            >
              ← Change email / Resend code
            </button>
          </div>
        )}

        {/* ── REGISTER DONE ── */}
        {tab === 'register' && regDone && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: '#81c784', marginBottom: 10, fontSize: 17 }}>Account Created!</h3>
            <p style={{ color: '#aaa', fontSize: 13, lineHeight: 1.8 }}>
              Your account is pending admin approval.<br />
              You will be able to login once approved.
            </p>
            <button type="button" className="auth-btn" style={{ marginTop: 16 }} onClick={() => switchTab('login')}>
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
