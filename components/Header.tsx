import Link from 'next/link'
import Image from 'next/image'
import React from 'react'

export default function Header() {
  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Image src="/sukejuru-logo.svg" alt="sukejuru" width={160} height={48} />
      </div>

      <h1 className="app-title" style={{ margin: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Sukejuru</span>
      </h1>

      <div className="user-info">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/" className="nav-btn">📅 Calendar</Link>
          <Link href="/courses" className="nav-btn">📚 Courses</Link>
          <Link href="/todo" className="nav-btn">📝 Todo</Link>
          <Link href="/friends" className="nav-btn">👥 Friends</Link>
          <Link href="/profile" className="nav-btn">Profile</Link>
        </div>
      </div>
    </header>
  )
}
