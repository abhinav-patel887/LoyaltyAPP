'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Business, Customer, StampRequest } from '@/lib/db'

interface DashData {
  business: Business
  stats: { totalCustomers: number; todayScans: number; totalRewards: number; returningRate: number }
  customers: Customer[]
  pending: StampRequest[]
  activity: StampRequest[]
}

export default function Dashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [tab, setTab] = useState<'pending' | 'customers' | 'settings'>('pending')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [billAmounts, setBillAmounts] = useState<Record<string, string>>({})
  const [settingsForm, setSettingsForm] = useState({ name: '', stampGoal: 3, minAmount: 200, rewardText: '', address: '' })
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, type: 'success' | 'error') {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('biz_token') : null

  const fetchData = useCallback(async () => {
    if (!token) { router.push('/login'); return }
    try {
      const res = await fetch('/api/business', { headers: { Authorization: `Bearer ${token}` } })
      if (res.status === 401) { router.push('/login'); return }
      const d = await res.json()
      setSettingsForm(prev => prev.name ? prev : { name: d.business.name, stampGoal: d.business.stampGoal, minAmount: d.business.minAmount, rewardText: d.business.rewardText, address: d.business.address || '' })
      setData(d)
      setQrUrl(`${window.location.origin}/scan/${d.business.id}`)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token, router])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const iv = setInterval(fetchData, 5000) // Poll for pending requests
    return () => clearInterval(iv)
  }, [fetchData])

  async function resolve(requestId: string, action: 'approved' | 'rejected') {
    const bill = parseInt(billAmounts[requestId] || '0')
    if (action === 'approved' && bill < (data?.business.minAmount || 200)) return
    setActionLoading(requestId)
    const req = data?.pending.find(r => r.id === requestId)
    try {
      await fetch('/api/stamps', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, action, billAmount: bill })
      })
      await fetchData()
      if (action === 'approved') {
        showToast(`✓ Stamp confirmed for ${req?.customerName || req?.customerPhone || 'customer'}`, 'success')
      } else {
        showToast(`✗ Request rejected for ${req?.customerName || req?.customerPhone || 'customer'}`, 'error')
      }
    } finally { setActionLoading(null) }
  }

  async function redeem(customerId: string) {
    const amountStr = window.prompt("How much did the customer save today? (₹)")
    if (amountStr === null) return // cancelled
    const savedAmount = parseInt(amountStr, 10)
    if (isNaN(savedAmount) || savedAmount < 0) {
      showToast("Please enter a valid amount", "error")
      return
    }

    setActionLoading(customerId)
    try {
      await fetch('/api/stamps/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerId, savedAmount })
      })
      await fetchData()
      showToast(`✓ Reward redeemed (₹${savedAmount} saved)`, "success")
    } finally { setActionLoading(null) }
  }

  async function saveSettings() {
    await fetch('/api/business', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settingsForm)
    })
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
    await fetchData()
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--c-bg)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner spinner-dark" style={{ marginBottom: 16 }} />
        <p style={{ color: 'var(--c-ink3)', fontSize: 14 }}>Loading dashboard...</p>
      </div>
    </div>
  )

  if (!data) return null

  const { business, stats, customers, pending, activity } = data
  const minAmt = business.minAmount

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 9999,
          background: toast.type === 'success' ? '#1a7a4a' : '#c0392b',
          color: '#fff', padding: '14px 22px', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
          fontFamily: 'var(--font-sans)', fontSize: 15, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 10,
          animation: 'toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          maxWidth: 340,
        }}>
          <span style={{ fontSize: 20 }}>{toast.type === 'success' ? '🎉' : '❌'}</span>
          {toast.msg}
        </div>
      )}
      {/* Top nav */}
      <header style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: 20, letterSpacing: '-0.02em' }}>Orbitly</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, color: 'var(--c-ink2)' }}>{business.name}</span>
            {pending.length > 0 && (
              <span style={{ background: 'var(--c-red)', color: '#fff', borderRadius: 'var(--radius-full)', fontSize: 11, fontWeight: 600, padding: '2px 7px' }}>
                {pending.length} pending
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('biz_token'); router.push('/login') }}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
          {[
            { label: 'Scans today', value: stats.todayScans },
            { label: 'Total customers', value: stats.totalCustomers },
            { label: 'Rewards given', value: stats.totalRewards },
            { label: 'Return rate', value: `${stats.returningRate}%` },
          ].map((s, i) => (
            <div key={i} className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: 'var(--c-ink)', marginBottom: 4, letterSpacing: '-0.02em' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: 'var(--c-ink3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* Main panel */}
          <div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
              {(['pending', 'customers', 'settings'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{
                    flex: 1, padding: '9px 16px', borderRadius: 'var(--radius-md)', border: 'none',
                    background: tab === t ? 'var(--c-ink)' : 'transparent',
                    color: tab === t ? 'var(--c-accent-fg)' : 'var(--c-ink2)',
                    fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                  }}>
                  {t === 'pending' ? 'Pending' : t === 'customers' ? 'Customers' : 'Settings'}
                  {t === 'pending' && pending.length > 0 && (
                    <span style={{ background: tab === 'pending' ? 'rgba(247,245,240,0.25)' : 'var(--c-red)', color: '#fff', borderRadius: 'var(--radius-full)', fontSize: 11, padding: '1px 6px' }}>{pending.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Pending approvals */}
            {tab === 'pending' && (
              <div className="anim-fade-up">
                {pending.length === 0 ? (
                  <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>All clear</div>
                    <div style={{ fontSize: 14, color: 'var(--c-ink3)' }}>No pending stamp requests right now</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pending.map(req => {
                      const bill = parseInt(billAmounts[req.id] || '0')
                      const qualifies = bill >= minAmt
                      return (
                        <div key={req.id} className="card" style={{ padding: '18px 20px', borderLeft: '3px solid var(--c-amber)' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                            <div>
                              <div style={{ fontWeight: 500, marginBottom: 2 }}>{req.customerName || 'Customer'}</div>
                              <div style={{ fontSize: 13, color: 'var(--c-ink3)', marginBottom: 12 }}>
                                {req.customerPhone} · Requested {new Date(req.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, maxWidth: 200 }}>
                                  <span style={{ padding: '0 12px', background: 'var(--c-surface2)', border: '1.5px solid var(--c-border2)', borderRight: 'none', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', fontSize: 14, color: 'var(--c-ink2)', height: 42, display: 'flex', alignItems: 'center' }}>₹</span>
                                  <input type="number" placeholder={`Min ${minAmt}`}
                                    value={billAmounts[req.id] || ''} min={0}
                                    onChange={e => setBillAmounts(prev => ({ ...prev, [req.id]: e.target.value }))}
                                    style={{ borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', borderLeft: 'none', padding: '10px 12px', fontSize: 14 }}
                                  />
                                </div>
                                {bill > 0 && !qualifies && (
                                  <span style={{ fontSize: 12, color: 'var(--c-red)' }}>Below ₹{minAmt}</span>
                                )}
                                {qualifies && (
                                  <span style={{ fontSize: 12, color: 'var(--c-green)' }}>✓ Qualifies</span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                              <button className="btn btn-green btn-sm" onClick={() => resolve(req.id, 'approved')}
                                disabled={!qualifies || actionLoading === req.id}>
                                {actionLoading === req.id ? <span className="spinner" /> : 'Confirm stamp'}
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => resolve(req.id, 'rejected')}
                                disabled={actionLoading === req.id}>
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Recent activity */}
                {activity.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent activity</h3>
                    <div className="card" style={{ overflow: 'hidden' }}>
                      {activity.slice(0, 8).map((a, i) => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: i < Math.min(activity.length, 8) - 1 ? '1px solid var(--c-border)' : 'none' }}>
                          <div>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{a.customerName || a.customerPhone}</span>
                            {a.billAmount && <span style={{ fontSize: 13, color: 'var(--c-ink3)', marginLeft: 8 }}>₹{a.billAmount}</span>}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span className={`badge ${a.status === 'approved' ? 'badge-green' : 'badge-red'}`}>
                              {a.status}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--c-ink3)' }}>
                              {new Date(a.resolvedAt || '').toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customers */}
            {tab === 'customers' && (
              <div className="anim-fade-up">
                {customers.length === 0 ? (
                  <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>No customers yet</div>
                    <div style={{ fontSize: 14, color: 'var(--c-ink3)' }}>Share your QR code to get your first loyal customer</div>
                  </div>
                ) : (
                  <div className="card" style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 120px', gap: 0, padding: '10px 18px', borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface2)' }}>
                      {['Customer', 'Stamps', 'Visits', 'Redeemed', ''].map((h, i) => (
                        <span key={i} style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-ink3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
                      ))}
                    </div>
                    {customers.map((c, i) => {
                      const hasReward = c.stamps >= business.stampGoal
                      return (
                        <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 120px', alignItems: 'center', padding: '13px 18px', borderBottom: i < customers.length - 1 ? '1px solid var(--c-border)' : 'none' }}>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{c.name || 'Customer'}</div>
                            <div style={{ fontSize: 12, color: 'var(--c-ink3)' }}>{c.phone}</div>
                          </div>
                          <div>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {Array.from({ length: business.stampGoal }, (_, j) => (
                                <div key={j} style={{ width: 8, height: 8, borderRadius: '50%', background: j < c.stamps ? 'var(--c-green)' : 'var(--c-border2)' }} />
                              ))}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--c-ink3)', marginTop: 3 }}>{c.stamps}/{business.stampGoal}</div>
                          </div>
                          <div style={{ fontSize: 14, color: 'var(--c-ink2)' }}>{c.totalVisits}</div>
                          <div style={{ fontSize: 14, color: 'var(--c-ink2)' }}>{c.redeemed}</div>
                          <div>
                            {hasReward ? (
                              <button className="btn btn-green btn-sm" onClick={() => redeem(c.id)} disabled={actionLoading === c.id}>
                                {actionLoading === c.id ? <span className="spinner" /> : 'Redeem →'}
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--c-ink3)' }}>
                                {c.lastVisit ? new Date(c.lastVisit).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No visits'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Settings */}
            {tab === 'settings' && (
              <div className="anim-fade-up card card-pad">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink2)', display: 'block', marginBottom: 6 }}>Business name</label>
                    <input type="text" value={settingsForm.name} onChange={e => setSettingsForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink2)', display: 'block', marginBottom: 6 }}>Address</label>
                    <input type="text" placeholder="e.g. Shop 4, Kondapur Main Road" value={settingsForm.address} onChange={e => setSettingsForm(p => ({ ...p, address: e.target.value }))} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink2)', display: 'block', marginBottom: 6 }}>Stamps needed</label>
                      <select value={settingsForm.stampGoal} onChange={e => setSettingsForm(p => ({ ...p, stampGoal: parseInt(e.target.value) }))}>
                        {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} visits</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink2)', display: 'block', marginBottom: 6 }}>Minimum bill (₹)</label>
                      <select value={settingsForm.minAmount} onChange={e => setSettingsForm(p => ({ ...p, minAmount: parseInt(e.target.value) }))}>
                        {[100, 150, 200, 300, 500].map(n => <option key={n} value={n}>₹{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink2)', display: 'block', marginBottom: 6 }}>Reward text</label>
                    <input type="text" placeholder="e.g. ₹200 off your next bill" value={settingsForm.rewardText} onChange={e => setSettingsForm(p => ({ ...p, rewardText: e.target.value }))} />
                  </div>
                  <button className="btn btn-primary" style={{ alignSelf: 'flex-start', minWidth: 140 }} onClick={saveSettings}>
                    {settingsSaved ? '✓ Saved' : 'Save changes'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar: QR + info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card card-pad" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink3)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your QR code</div>
              {qrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrUrl)}&bgcolor=FFFFFF&color=1A1916&margin=2`}
                  alt="QR Code" width={180} height={180}
                  style={{ borderRadius: 'var(--radius-md)', display: 'block', margin: '0 auto 14px' }} />
              )}
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{business.name}</div>
              <div style={{ fontSize: 12, color: 'var(--c-ink3)', marginBottom: 14, wordBreak: 'break-all' }}>{qrUrl}</div>
              <a href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrUrl)}&bgcolor=FFFFFF&color=1A1916&margin=4`}
                download="orbitly-qr.png" className="btn btn-secondary btn-full btn-sm">
                Download to print
              </a>
            </div>

            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-ink3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current offer</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                Visit <strong>{business.stampGoal}×</strong> spending ≥<strong>₹{business.minAmount}</strong> to earn:
              </div>
              <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--c-green-bg)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 500, color: 'var(--c-green)' }}>
                {business.rewardText}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
