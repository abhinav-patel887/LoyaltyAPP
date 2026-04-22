'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Business, Customer, StampRequest } from '@/lib/db'

type CustomerWithBusiness = Customer & { business: Business | undefined }

interface CustomerData {
  customer: Customer
  business: Business
  pending: StampRequest | null
  history: StampRequest[]
  allBusinesses: CustomerWithBusiness[]
  totalSaved: number
}

export default function ScanPage() {
  const { businessId } = useParams<{ businessId: string }>()
  const [step, setStep] = useState<'phone' | 'otp' | 'name' | 'card'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [nameInput, setNameInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [token, setToken] = useState('')
  const [data, setData] = useState<CustomerData | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [newStamp, setNewStamp] = useState(false)
  const [activeTab, setActiveTab] = useState<'card' | 'history' | 'clubs'>('card')
  const [earlyBiz, setEarlyBiz] = useState<Business | null>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // Fetch business info early so we can show it on the phone step
  useEffect(() => {
    if (businessId && businessId !== 'demo') {
      fetch(`/api/business?id=${businessId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.business) setEarlyBiz(d.business) })
        .catch(() => {})
    }
  }, [businessId])

  const fetchCard = useCallback(async (t: string) => {
    const res = await fetch('/api/customer', { headers: { Authorization: `Bearer ${t}` } })
    if (!res.ok) return
    const d = await res.json()
    setData(d)
  }, [])

  // Poll when there is a pending request
  useEffect(() => {
    if (step !== 'card' || !data?.pending || !token) return
    const iv = setInterval(async () => {
      const res = await fetch('/api/customer', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const d = await res.json()
      const prevStamps = data?.customer?.stamps ?? 0
      if (d.customer.stamps > prevStamps) {
        setNewStamp(true)
        setTimeout(() => setNewStamp(false), 2000)
      }
      setData(d)
    }, 3000)
    return () => clearInterval(iv)
  }, [step, data?.pending, token, data?.customer?.stamps])

  async function sendOtp() {
    setError('')
    const cleaned = phone.replace(/\D/g, '').slice(-10)
    if (cleaned.length !== 10) { setError('Enter a valid 10-digit mobile number'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned, role: 'customer', businessId })
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      if (d.devOtp) setDevOtp(d.devOtp)
      setStep('otp')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  async function verifyOtp() {
    setError('')
    const code = otp.join('')
    if (code.length !== 6) { setError('Enter all 6 digits'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/\D/g, '').slice(-10), otp: code, role: 'customer', businessId })
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setToken(d.token)
      // If new customer (no name), go to name step
      if (!d.customer.name) {
        setStep('name')
        // Store partial data
        setData({ customer: d.customer, business: d.business, pending: null, history: [], allBusinesses: [], totalSaved: 0 })
      } else {
        await fetchCard(d.token)
        setStep('card')
      }
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Invalid OTP') }
    finally { setLoading(false) }
  }

  async function saveName() {
    setError('')
    if (!nameInput.trim()) { setError('Please enter your name'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/customer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nameInput.trim() })
      })
      if (!res.ok) throw new Error('Failed to save name')
      await fetchCard(token)
      setStep('card')
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  async function requestStamp() {
    if (!token || requesting) return
    setRequesting(true)
    setError('')
    try {
      const res = await fetch('/api/stamps', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      await fetchCard(token)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setRequesting(false) }
  }

  function handleOtpChange(i: number, val: string) {
    const v = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[i] = v; setOtp(next)
    if (v && i < 5) otpRefs.current[i + 1]?.focus()
  }
  function handleOtpKey(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
  }

  const customer = data?.customer
  const business = data?.business
  const stamps = customer?.stamps ?? 0
  const goal = business?.stampGoal ?? 3
  const hasReward = stamps >= goal
  const pending = data?.pending ?? null
  const isDemo = businessId === 'demo'
  const totalSaved = data?.totalSaved ?? 0

  // Business shown before OTP (loaded early)
  const displayBiz = business || earlyBiz

  const wrap = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {displayBiz && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>{displayBiz.name}</h2>
            {displayBiz.address && <p style={{ fontSize: 13, color: 'var(--c-ink3)' }}>{displayBiz.address}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )

  if (isDemo) return wrap(
    <div className="card card-pad anim-scale-in" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
      <h3 className="font-serif" style={{ fontSize: 24, marginBottom: 8 }}>Demo mode</h3>
      <p style={{ fontSize: 14, color: 'var(--c-ink2)', lineHeight: 1.6 }}>This is what customers see after scanning your QR code. Log in as a business to get your real QR.</p>
    </div>
  )

  // ── Phone step ────────────────────────────────────────────
  if (step === 'phone') return wrap(
    <div className="anim-scale-in">
      <h1 className="font-serif" style={{ fontSize: 30, marginBottom: 8, letterSpacing: '-0.02em', textAlign: 'center' }}>Earn your reward</h1>
      <p style={{ color: 'var(--c-ink2)', marginBottom: 32, fontSize: 14, lineHeight: 1.6, textAlign: 'center' }}>
        Enter your mobile number to see your stamp card
      </p>
      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', background: 'var(--c-surface2)', border: '1.5px solid var(--c-border2)', borderRight: 'none', borderRadius: 'var(--radius-md) 0 0 var(--radius-md)', fontSize: 15, color: 'var(--c-ink2)', fontWeight: 500, flexShrink: 0 }}>+91</div>
        <input type="tel" placeholder="Mobile number" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOtp()} style={{ borderRadius: '0 var(--radius-md) var(--radius-md) 0', borderLeft: 'none' }} maxLength={10} autoFocus />
      </div>
      {error && <p style={{ color: 'var(--c-red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn btn-primary btn-full" onClick={sendOtp} disabled={loading}>
        {loading ? <><span className="spinner" />Sending OTP...</> : 'Continue →'}
      </button>
    </div>
  )

  // ── OTP step ──────────────────────────────────────────────
  if (step === 'otp') return wrap(
    <div className="anim-scale-in">
      <button className="btn btn-ghost" style={{ padding: '8px 0', color: 'var(--c-ink3)', marginBottom: 20 }} onClick={() => { setStep('phone'); setOtp(['', '', '', '', '', '']); setError('') }}>← Back</button>
      <h1 className="font-serif" style={{ fontSize: 30, marginBottom: 8, letterSpacing: '-0.02em', textAlign: 'center' }}>Enter OTP</h1>
      <p style={{ color: 'var(--c-ink2)', marginBottom: 28, fontSize: 14, textAlign: 'center' }}>Sent to WhatsApp <strong>+91 {phone}</strong></p>
      {devOtp && (
        <div style={{ background: 'var(--c-amber-bg)', border: '1px solid #F0D090', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--c-amber)', textAlign: 'center' }}>
          Dev OTP: <strong style={{ fontSize: 16, letterSpacing: 3 }}>{devOtp}</strong>
        </div>
      )}
      <div className="otp-grid" style={{ marginBottom: 14 }}>
        {otp.map((d, i) => (
          <input key={i} type="tel" maxLength={1} value={d}
            ref={el => { otpRefs.current[i] = el }}
            onChange={e => handleOtpChange(i, e.target.value)}
            onKeyDown={e => handleOtpKey(i, e)}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {error && <p style={{ color: 'var(--c-red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn btn-primary btn-full" onClick={verifyOtp} disabled={loading}>
        {loading ? <><span className="spinner" />Verifying...</> : 'Verify OTP →'}
      </button>
    </div>
  )

  // ── Name step (new customers only) ───────────────────────
  if (step === 'name') return wrap(
    <div className="anim-scale-in">
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
        <h1 className="font-serif" style={{ fontSize: 28, marginBottom: 8, letterSpacing: '-0.02em' }}>Welcome!</h1>
        <p style={{ color: 'var(--c-ink2)', fontSize: 14, lineHeight: 1.6 }}>
          What should we call you? Your name will be shown to {displayBiz?.name || 'the business'} so they can greet you personally.
        </p>
      </div>
      <input
        type="text"
        placeholder="Your full name"
        value={nameInput}
        onChange={e => setNameInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && saveName()}
        autoFocus
        style={{ marginBottom: 12 }}
      />
      {error && <p style={{ color: 'var(--c-red)', fontSize: 13, marginBottom: 10 }}>{error}</p>}
      <button className="btn btn-primary btn-full" onClick={saveName} disabled={loading}>
        {loading ? <><span className="spinner" />Saving...</> : 'Get my stamp card →'}
      </button>
    </div>
  )

  // ── Card step ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', padding: 16 }}>
      <div style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Business header */}
        {business && (
          <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>{business.name}</h2>
            {customer?.name && <p style={{ fontSize: 13, color: 'var(--c-ink3)' }}>Hi, {customer.name} 👋</p>}
          </div>
        )}

        {/* Total Saved Banner */}
        {totalSaved > 0 && (
          <div className="anim-scale-in" style={{
            background: 'linear-gradient(135deg, #0f5c36 0%, #1a7a4a 100%)',
            borderRadius: 'var(--radius-lg)', padding: '18px 24px', marginBottom: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginBottom: 4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total saved here</div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: '#fff', letterSpacing: '-0.02em', fontWeight: 700, lineHeight: 1.1 }}>
                ₹{totalSaved.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 6, fontWeight: 500 }}>
                Across {customer?.redeemed || 0} reward{(customer?.redeemed || 0) !== 1 ? 's' : ''} earned 🎉
              </div>
            </div>
            <div style={{ fontSize: 36 }}>💰</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
          {(['card', 'history', 'clubs'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              flex: 1, padding: '9px 8px', borderRadius: 'var(--radius-md)', border: 'none',
              background: activeTab === t ? 'var(--c-ink)' : 'transparent',
              color: activeTab === t ? 'var(--c-accent-fg)' : 'var(--c-ink2)',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s'
            }}>
              {t === 'card' ? '🎟 Card' : t === 'history' ? '📋 History' : '🏪 My Clubs'}
            </button>
          ))}
        </div>

        {/* ── CARD TAB ── */}
        {activeTab === 'card' && (
          <div className="anim-scale-in">
            <div className="card" style={{ padding: '24px 24px 20px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--c-ink3)', marginBottom: 2 }}>Your stamps</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, letterSpacing: '-0.02em' }}>
                    {stamps}<span style={{ color: 'var(--c-ink3)', fontSize: 18 }}>/{goal}</span>
                  </div>
                </div>
                {hasReward && <span className="badge badge-green" style={{ fontSize: 13, padding: '5px 12px' }}>Reward ready!</span>}
                {pending && !hasReward && <span className="badge badge-amber">Waiting for cashier...</span>}
              </div>

              {/* Stamps grid */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(goal, 5)}, 1fr)`, gap: 8, marginBottom: 18 }}>
                {Array.from({ length: goal }, (_, i) => {
                  const filled = i < stamps
                  const isPending = !filled && pending && i === stamps
                  return (
                    <div key={i} style={{
                      aspectRatio: '1', borderRadius: 'var(--radius-md)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: filled ? 'var(--c-ink)' : isPending ? 'var(--c-amber-bg)' : 'var(--c-surface2)',
                      border: filled ? 'none' : isPending ? '2px dashed #D4A017' : '2px dashed var(--c-border2)',
                      animation: filled && newStamp && i === stamps - 1 ? 'stampPop 0.5s ease' : 'none',
                      transition: 'all 0.3s'
                    }}>
                      {filled ? (
                        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                          <circle cx="11" cy="11" r="10" stroke="rgba(247,245,240,0.3)" strokeWidth="1.5" />
                          <path d="M7 11l3 3 5-5" stroke="var(--c-accent-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : isPending ? (
                        <div className="spinner" style={{ borderColor: 'rgba(160,90,0,0.25)', borderTopColor: 'var(--c-amber)', width: 16, height: 16 }} />
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--c-ink3)', fontWeight: 500 }}>{i + 1}</span>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, background: 'var(--c-surface2)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: hasReward ? 'var(--c-green)' : 'var(--c-ink)', borderRadius: 99, width: `${Math.min((stamps / goal) * 100, 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: 'var(--c-ink2)', textAlign: 'center' }}>
                {hasReward
                  ? `Show this screen to the cashier to redeem`
                  : pending
                    ? `Waiting for cashier to confirm your purchase`
                    : `${goal - stamps} more visit${goal - stamps !== 1 ? 's' : ''} to earn: ${business?.rewardText}`}
              </div>
            </div>

            {/* Reward box */}
            {hasReward && (
              <div className="anim-scale-in" style={{ background: 'var(--c-green)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Your reward</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: '#fff', letterSpacing: '-0.01em' }}>{business?.rewardText}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Ask the cashier to scan and redeem</div>
              </div>
            )}

            {/* Action button */}
            {!hasReward && !pending && (
              <button className="btn btn-primary btn-full" onClick={requestStamp} disabled={requesting} style={{ marginBottom: 10 }}>
                {requesting ? <><span className="spinner" />Requesting...</> : 'Request stamp →'}
              </button>
            )}

            {error && <p style={{ color: 'var(--c-red)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{error}</p>}

            <p style={{ fontSize: 12, color: 'var(--c-ink3)', textAlign: 'center', lineHeight: 1.6, marginTop: 8 }}>
              {customer?.totalVisits ? `${customer.totalVisits} total visit${customer.totalVisits !== 1 ? 's' : ''}` : 'Your first visit!'}
              {customer?.redeemed ? ` · ${customer.redeemed} reward${customer.redeemed > 1 ? 's' : ''} earned` : ''}
            </p>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === 'history' && (
          <div className="anim-fade-up">
            {!data?.history?.length ? (
              <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>No history yet</div>
                <div style={{ fontSize: 14, color: 'var(--c-ink3)' }}>Your stamp activity at {business?.name} will appear here</div>
              </div>
            ) : (
              <div className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface2)' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-ink3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Stamp history at {business?.name}
                  </div>
                </div>
                {data.history.map((h, i) => (
                  <div key={h.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: i < data.history.length - 1 ? '1px solid var(--c-border)' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                        background: h.status === 'approved' ? 'var(--c-green-bg)' : 'var(--c-red-bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0
                      }}>
                        {h.status === 'approved' ? '✓' : '✗'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500, color: h.status === 'approved' ? 'var(--c-green)' : 'var(--c-red)' }}>
                          {h.status === 'approved' ? 'Stamp added' : 'Rejected'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--c-ink3)' }}>
                          {new Date(h.resolvedAt || h.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {new Date(h.resolvedAt || h.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {h.billAmount ? (
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--c-ink2)' }}>₹{h.billAmount}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MY CLUBS TAB ── */}
        {activeTab === 'clubs' && (
          <div className="anim-fade-up">
            {!data?.allBusinesses?.length ? (
              <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏪</div>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>No clubs yet</div>
                <div style={{ fontSize: 14, color: 'var(--c-ink3)' }}>Visit more businesses to see them here</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.allBusinesses.map(cb => {
                  const biz = cb.business
                  if (!biz) return null
                  const cbGoal = biz.stampGoal ?? 3
                  const isCurrentBiz = biz.id === businessId
                  return (
                    <div key={cb.id} className="card" style={{
                      padding: '18px 20px',
                      border: isCurrentBiz ? '2px solid var(--c-ink)' : '1px solid var(--c-border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                          width: 44, height: 44, background: isCurrentBiz ? 'var(--c-ink)' : 'var(--c-surface2)',
                          borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-serif)', fontSize: 18,
                          color: isCurrentBiz ? 'var(--c-accent-fg)' : 'var(--c-ink2)', flexShrink: 0
                        }}>
                          {biz.name.charAt(0)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <div style={{ fontWeight: 500, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{biz.name}</div>
                            {isCurrentBiz && <span className="badge badge-ink" style={{ fontSize: 10 }}>Here</span>}
                          </div>
                          {/* Mini stamp dots */}
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {Array.from({ length: cbGoal }, (_, j) => (
                              <div key={j} style={{
                                width: 10, height: 10, borderRadius: '50%',
                                background: j < cb.stamps ? 'var(--c-green)' : 'var(--c-border2)'
                              }} />
                            ))}
                            <span style={{ fontSize: 12, color: 'var(--c-ink3)', marginLeft: 4 }}>
                              {cb.stamps} of {cbGoal}
                            </span>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink)' }}>{cb.totalVisits} visit{cb.totalVisits !== 1 ? 's' : ''}</div>
                          {cb.redeemed > 0 && (
                            <div style={{ fontSize: 12, color: 'var(--c-green)' }}>{cb.redeemed} reward{cb.redeemed > 1 ? 's' : ''}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
