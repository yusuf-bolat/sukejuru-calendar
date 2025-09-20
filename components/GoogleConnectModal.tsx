import { useState } from 'react'

export default function GoogleConnectModal({ session, onClose }: { session: any, onClose: () => void }) {
  const [preferredEmail, setPreferredEmail] = useState('')
  const [includePast, setIncludePast] = useState(false)

  const startConnect = () => {
    if (!session?.user?.id) return alert('Not signed in')

    // open OAuth start in a small popup and include survey params if useful
    const params = new URLSearchParams()
    params.set('uid', session.user.id)
    if (preferredEmail) params.set('preferredEmail', preferredEmail)
    if (includePast) params.set('includePast', '1')

    const url = `/api/auth/google/start?${params.toString()}`
    // small popup window
    window.open(url, 'google_oauth', 'width=600,height=700,menubar=no,toolbar=no')
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose}></div>
      <div style={{ background: '#0f1724', color: '#e6eef8', borderRadius: 10, padding: 20, width: 360, boxShadow: '0 20px 60px rgba(2,6,23,0.6)', zIndex: 10001 }}>
        <h3 style={{ margin: 0, marginBottom: 8 }}>Connect your Google Calendar</h3>
        <p style={{ marginTop: 0, color: '#cbd5e1', fontSize: 13 }}>Choose an account in the next step. Optionally tell us a preferred email or include past events in the export.</p>

        <label style={{ display: 'block', marginTop: 10, fontSize: 13, color: '#cbd5e1' }}>Preferred Google email (optional)</label>
        <input value={preferredEmail} onChange={e => setPreferredEmail(e.target.value)} placeholder="name@example.com" style={{ width: '100%', padding: '8px 10px', marginTop: 6, borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)', background: '#08101a', color: '#e6eef8' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input type="checkbox" checked={includePast} onChange={e => setIncludePast(e.target.checked)} />
          <span style={{ color: '#cbd5e1', fontSize: 13 }}>Include past events in export</span>
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: 'transparent', color: '#9aa6b2' }}>Cancel</button>
          <button onClick={startConnect} style={{ padding: '8px 12px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#ffffff', fontWeight: 600 }}>Continue to Google</button>
        </div>
      </div>
    </div>
  )
}
