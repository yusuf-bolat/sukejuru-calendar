
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'

export default function FriendsPage() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setLoading(false)
      if (!session) {
        router.push('/auth/login')
        return
      }
    }
    checkAuth()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (!s) {
        router.push('/auth/login')
      }
    })
    return () => { sub?.subscription.unsubscribe() }
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-lg">Redirecting to login...</div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: 'white', fontSize: '24px', fontWeight: '700' }}>
            👥 Friends
          </span>
        </div>
        <div className="app-title" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <Image 
            src="/sukejuru-logo.svg" 
            alt="sukejuru" 
            width={200} 
            height={60}
            style={{ color: 'white' }}
          />
        </div>
        <div className="user-info">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/" className="nav-btn">
              Calendar
            </Link>
            <Link href="/courses" className="nav-btn">
              📚 Courses
            </Link>
            <Link href="/todo" className="nav-btn">
              📝 Todo
            </Link>
            <Link href="/profile" className="nav-btn">
              Profile
            </Link>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="logout-btn"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="main-content" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ color: '#f2f2f2', fontSize: '28px', margin: 0, fontWeight: '600', marginBottom: '24px' }}>Your Friends</h2>
        <div style={{
          background: 'linear-gradient(135deg, #2a2a2a 0%, #1e1e1e 100%)',
          borderRadius: '16px',
          padding: '32px',
          border: '1px solid #333',
          color: '#e1e5e9',
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
          <h3 style={{ color: '#4fc3f7', marginBottom: '8px' }}>Friends features coming soon!</h3>
          <p style={{ color: '#aaa', fontSize: '16px', textAlign: 'center', maxWidth: '500px' }}>
            Here you will be able to add, view, and manage your friends. Stay tuned for updates!
          </p>
        </div>
      </div>

      <div className="site-footer">
        <span>© 2025 Student Calendar • </span>
        <a href="#" target="_blank" rel="noopener">Privacy Policy</a>
      </div>
    </div>
  )
}
