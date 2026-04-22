'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [isNew, setIsNew] = useState(false)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const token = localStorage.getItem('biz_token')
    if (token) router.push('/dashboard')
  }, [router])

  async function sendOtp() {
    setError('')
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, role: 'business' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.devOtp) setDevOtp(data.devOtp)
      setStep('otp')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Enter all 6 digits'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp: code, role: 'business' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.business.name === 'My Business' || !data.business.address) {
        setIsNew(true)
        setName(data.business.name === 'My Business' ? '' : data.business.name)
        localStorage.setItem('biz_token', data.token)
        setStep('name')
      } else {
        localStorage.setItem('biz_token', data.token)
        router.push('/dashboard')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  async function saveName() {
    if (!name.trim()) { setError('Enter your business name'); return }
    setLoading(true)
    const token = localStorage.getItem('biz_token')
    try {
      await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() })
      })
      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  function handleOtpChange(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = v
    setOtp(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (digits.length === 6) {
      setOtp(digits.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px 24px' }}>
        <Link href="/" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--c-ink)', textDecoration: 'none' }}>
          Orbitly
        </Link>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {step === 'phone' && (
            <div className="anim-scale-in">
              <h1 className="font-serif" style={{ fontSize: 34, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Welcome back
              </h1>
              <p style={{ color: 'var(--c-ink2)', marginBottom: 36, fontSize: 15, lineHeight: 1.6 }}>
                Enter your mobile number. We will send a one-time code on WhatsApp.
              </p>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', padding: '0 14px',
                    background: 'var(--c-surface2)', border: '1.5px solid var(--c-border2)',
                    borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)',
                    fontSize: 15, color: 'var(--c-ink2)', fontWeight: 500, flexShrink: 0
                  }}>+91</div>
                  <input
                    type="tel" placeholder="98765 43210"
                    value={phone} onChange={e => setPhone(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0', borderLeft: 'none' }}
                    maxLength={10} autoFocus
                  />
                </div>
              </div>
              {error && <p style={{ color: 'var(--c-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-primary btn-full" onClick={sendOtp} disabled={loading}>
                {loading ? <><span className="spinner" /> Sending...</> : 'Send OTP on WhatsApp →'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="anim-scale-in">
              <button className="btn btn-ghost" style={{ marginBottom: 24, padding: '8px 0', color: 'var(--c-ink3)' }}
                onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError('') }}>
                ← Back
              </button>
              <h1 className="font-serif" style={{ fontSize: 34, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Check WhatsApp
              </h1>
              <p style={{ color: 'var(--c-ink2)', marginBottom: 36, fontSize: 15, lineHeight: 1.6 }}>
                We sent a 6-digit code to <strong>+91 {phone}</strong>
              </p>

              {devOtp && (
                <div style={{ background: 'var(--c-amber-bg)', border: '1px solid #F0D090', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 20, fontSize: 13, color: 'var(--c-amber)' }}>
                  Dev mode — OTP: <strong style={{ fontSize: 16, letterSpacing: 2 }}>{devOtp}</strong>
                </div>
              )}

              <div className="otp-grid" style={{ marginBottom: 12 }} onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input key={i} type="tel" maxLength={1} value={d}
                    ref={el => { otpRefs.current[i] = el }}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {error && <p style={{ color: 'var(--c-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-primary btn-full" onClick={verifyOtp} disabled={loading}>
                {loading ? <><span className="spinner" /> Verifying...</> : 'Verify & continue →'}
              </button>
              <button className="btn btn-ghost btn-full" style={{ marginTop: 8, fontSize: 14 }} onClick={sendOtp}>
                Resend OTP
              </button>
            </div>
          )}

          {step === 'name' && (
            <div className="anim-scale-in">
              <h1 className="font-serif" style={{ fontSize: 34, marginBottom: 8, letterSpacing: '-0.02em' }}>
                Name your business
              </h1>
              <p style={{ color: 'var(--c-ink2)', marginBottom: 36, fontSize: 15, lineHeight: 1.6 }}>
                This is what your customers will see on their stamp card.
              </p>
              <input type="text" placeholder="e.g. Sharma Bakery" value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveName()}
                style={{ marginBottom: 12 }} autoFocus
              />
              {error && <p style={{ color: 'var(--c-red)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
              <button className="btn btn-primary btn-full" onClick={saveName} disabled={loading}>
                {loading ? <><span className="spinner" /> Saving...</> : 'Set up dashboard →'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
