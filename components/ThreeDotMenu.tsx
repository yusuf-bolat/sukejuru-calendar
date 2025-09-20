import { useEffect, useState, useRef } from 'react'

export default function ThreeDotMenu({ session }: { session: any }) {
  const [open, setOpen] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [pos, setPos] = useState<{ left: number, top: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const popupRef = useRef<Window | null>(null)

  useEffect(() => {
    const handler = (e: any) => {
      const rect = e?.detail?.rect
      if (rect) {
        // position menu to the right of the rect
        const left = rect.right + 8 + window.scrollX
        const top = rect.top + window.scrollY
        setPos({ left, top })
        setOpen(true)
      }
    }


    // listen for popup messages
    const msgHandler = (ev: MessageEvent) => {
      if (ev?.data?.type === 'google_connected') {
        setConnected(true)
      }
    }

    window.addEventListener('threeDot:open', handler as EventListener)
    window.addEventListener('message', msgHandler)
    return () => window.removeEventListener('threeDot:open', handler as EventListener)
  }, [])

  const handleConnect = async () => {
    if (!session?.user?.id) return alert('Not signed in')

    // Open OAuth start in a small popup and let user select account in Google's chooser
    const url = `/api/auth/google/start?uid=${session.user.id}`
    const popupWidth = 600
    const popupHeight = 700
    const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX
    const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY
    const width = window.innerWidth || document.documentElement.clientWidth || screen.width
    const height = window.innerHeight || document.documentElement.clientHeight || screen.height
    const left = dualScreenLeft + Math.max(0, (width - popupWidth) / 2)
    const top = dualScreenTop + Math.max(0, (height - popupHeight) / 2)
    const features = `scrollbars=yes,width=${popupWidth},height=${popupHeight},top=${top},left=${left},menubar=no,toolbar=no`
    const popup = window.open(url, 'google_oauth', features)
    popupRef.current = popup
    setOpen(false)
  }

  const handleExport = async () => {
    if (!session?.user?.id) return alert('Not signed in')

    const resp = await fetch('/api/export/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: session.user.id })
    })

    if (resp.status === 400) {
      // assume user not connected
      const shouldConnect = confirm('Google account not connected. Connect now?')
      if (shouldConnect) handleConnect()
      return
    }

    const json = await resp.json()
    if (resp.ok) {
      alert(`Created ${json.created?.length || 0} events in Google Calendar`)
    } else {
      alert('Export failed: ' + JSON.stringify(json))
    }

    setOpen(false)
  }

  const handleDisconnect = async () => {
    if (!session?.user?.id) return alert('Not signed in')
    const ok = confirm('Disconnect Google Calendar from this app? This will revoke saved tokens.')
    if (!ok) return

    try {
      const resp = await fetch(`/api/auth/google/logout?uid=${session.user.id}`, { method: 'POST' })
      const json = await resp.json()
      if (resp.ok) {
        alert('Disconnected Google account')
        setConnected(false)
      } else {
        alert('Failed to disconnect: ' + JSON.stringify(json))
      }
    } catch (err) {
      console.error('Disconnect error', err)
      alert('Network error while disconnecting')
    }

    setOpen(false)
  }

  // fetch connection status
  const fetchStatus = async () => {
    if (!session?.user?.id) return
    try {
      const resp = await fetch(`/api/auth/google/status?uid=${session.user.id}`)
      const json = await resp.json()
      setConnected(!!json.connected)
    } catch (e) {
      setConnected(null)
    }
  }

  useEffect(() => {
    fetchStatus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: pos?.left ?? undefined,
        top: pos?.top ?? undefined,
        display: open ? 'block' : 'none',
        zIndex: 9999
      }}
    >
      <div
        style={{
          background: '#0b1220',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(2,6,23,0.6)',
          color: '#e6eef8',
          minWidth: 220,
          overflow: 'hidden'
        }}
      >
        <button
          onClick={async ()=>{ await handleConnect(); fetchStatus() }}
          onMouseEnter={() => setHoverIndex(0)}
          onMouseLeave={() => setHoverIndex(null)}
          style={{
            display: 'block',
            padding: '10px 14px',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: hoverIndex === 0 ? '#0f1724' : 'transparent',
            color: '#e6f7ea',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontWeight: 600, color: '#bff3c9' }}>{connected ? 'Connected to Google' : 'Connect Google Calendar'}</span>
        </button>

        <button
          onClick={handleExport}
          onMouseEnter={() => setHoverIndex(1)}
          onMouseLeave={() => setHoverIndex(null)}
          style={{
            display: 'block',
            padding: '10px 14px',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: hoverIndex === 1 ? '#0f1724' : 'transparent',
            color: '#e6eef8',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontWeight: 600 }}>Export Calendar Now</span>
        </button>

        <button
          onClick={handleDisconnect}
          onMouseEnter={() => setHoverIndex(2)}
          onMouseLeave={() => setHoverIndex(null)}
          style={{
            display: 'block',
            padding: '10px 14px',
            width: '100%',
            textAlign: 'left',
            border: 'none',
            background: hoverIndex === 2 ? '#0f1724' : 'transparent',
            color: '#e6eef8',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontWeight: 600 }}>Disconnect Google</span>
        </button>
      </div>
      {/* modal removed per user request */}
    </div>
  )
}

function ThreeDotWrapper(props: any) {
  return <ThreeDotMenu {...props} />
}
