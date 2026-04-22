'use client'
import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--c-bg)' }}>
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px', maxWidth:1100, margin:'0 auto' }}>
        <span style={{ fontFamily:'var(--font-serif)', fontSize:22, color:'var(--c-ink)', letterSpacing:'-0.02em' }}>Orbitly</span>
        <div style={{ display:'flex', gap:8 }}>
          <Link href="/login" className="btn btn-ghost btn-sm">Business login</Link>
          <Link href="/login" className="btn btn-primary btn-sm">Get started</Link>
        </div>
      </nav>
      <section style={{ maxWidth:720, margin:'0 auto', padding:'80px 24px 60px', textAlign:'center' }}>
        <div className="anim-fade-up" style={{ animationDelay:'0.05s' }}>
          <span className="badge badge-green" style={{ marginBottom:20, display:'inline-flex' }}>Built for Hyderabad businesses</span>
        </div>
        <h1 className="anim-fade-up font-serif" style={{ fontSize:'clamp(42px,7vw,72px)', lineHeight:1.08, color:'var(--c-ink)', marginBottom:24, letterSpacing:'-0.03em', animationDelay:'0.1s' }}>
          Turn every visit<br /><span style={{ fontStyle:'italic' }}>into loyalty.</span>
        </h1>
        <p className="anim-fade-up" style={{ fontSize:18, color:'var(--c-ink2)', lineHeight:1.65, maxWidth:480, margin:'0 auto 40px', animationDelay:'0.15s' }}>
          QR-based loyalty for bakeries, salons, and local shops. No app download. No hardware. Setup in 10 minutes.
        </p>
        <div className="anim-fade-up" style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap', animationDelay:'0.2s' }}>
          <Link href="/login" className="btn btn-primary" style={{ fontSize:16, padding:'16px 32px' }}>Start free — 30 days →</Link>
          <Link href="/scan/demo" className="btn btn-secondary" style={{ fontSize:16, padding:'16px 32px' }}>See customer view</Link>
        </div>
      </section>
      <section style={{ maxWidth:900, margin:'0 auto 80px', padding:'0 24px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:16 }}>
          {[
            { icon:'⬡', title:'QR on your counter', body:'Print once. Customers scan with any phone. No app install needed.' },
            { icon:'◎', title:'Cashier confirms', body:'Only bills above your minimum earn a stamp. Completely fraud-proof.' },
            { icon:'◈', title:'WhatsApp nudges', body:'Auto messages remind customers when they are one visit away.' },
            { icon:'◇', title:'₹499/month', body:'Less than ₹17 a day. Cancel anytime. No setup fee.' },
          ].map((f,i) => (
            <div key={i} className="card card-pad anim-fade-up" style={{ animationDelay:`${0.1+i*0.06}s` }}>
              <div style={{ fontSize:22, marginBottom:12, color:'var(--c-ink3)' }}>{f.icon}</div>
              <div style={{ fontWeight:500, marginBottom:6, fontSize:15 }}>{f.title}</div>
              <div style={{ fontSize:14, color:'var(--c-ink2)', lineHeight:1.55 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ background:'var(--c-ink)', color:'var(--c-accent-fg)', borderRadius:'var(--radius-xl)', maxWidth:860, margin:'0 auto 80px', padding:'56px 40px', textAlign:'center' }}>
        <h2 className="font-serif" style={{ fontSize:36, marginBottom:8, letterSpacing:'-0.02em', fontStyle:'italic' }}>How it works</h2>
        <p style={{ color:'rgba(247,245,240,0.6)', marginBottom:48, fontSize:15 }}>Three steps. That is it.</p>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:32 }}>
          {[
            { n:'01', title:'Customer scans', body:'They scan your QR after paying. Opens instantly in browser.' },
            { n:'02', title:'You confirm', body:'Enter bill amount on dashboard. Stamp added only if above minimum.' },
            { n:'03', title:'They earn and return', body:'WhatsApp reminds them. They come back for the reward.' },
          ].map((s,i) => (
            <div key={i} style={{ textAlign:'left' }}>
              <div style={{ fontFamily:'var(--font-serif)', fontSize:13, color:'rgba(247,245,240,0.4)', marginBottom:12 }}>{s.n}</div>
              <div style={{ fontWeight:500, fontSize:16, marginBottom:8 }}>{s.title}</div>
              <div style={{ fontSize:14, color:'rgba(247,245,240,0.6)', lineHeight:1.6 }}>{s.body}</div>
            </div>
          ))}
        </div>
      </section>
      <footer style={{ textAlign:'center', padding:'0 24px 48px' }}>
        <p style={{ fontSize:13, color:'var(--c-ink3)' }}>Made for local businesses in Hyderabad</p>
      </footer>
    </main>
  )
}
