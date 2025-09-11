import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Link from 'next/link'
import Image from 'next/image'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [program, setProgram] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [university, setUniversity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Program options based on university selection
  const getPrograms = () => {
    if (university === 'Kyoto University of Advanced Science') {
      return [
        'Mechanical and Electrical Engineering',
        'Bioenvironmental Science', 
        'Business and Global Economics'
      ]
    }
    return []
  }

  // Reset program when university changes
  const handleUniversityChange = (value: string) => {
    setUniversity(value)
    setProgram('') // Reset program selection
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, program, graduation_year: graduationYear, university_name: university }
      }
    })
    setLoading(false)
    if (error) setError(error.message)
    else window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-6">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl w-full max-w-lg p-8">
        {/* Header with Logo and Icon */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Image 
              src="/sukejuru-logo.svg" 
              alt="sukejuru" 
              width={200} 
              height={60}
              style={{ color: 'white' }}
            />
          </div>
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
          <p className="text-white/70">Welcome to Student Calendar</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Full Name</label>
              <input 
                placeholder="Enter your full name" 
                value={name} 
                onChange={e=>setName(e.target.value)} 
                required 
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Program / Major</label>
              {university === 'Kyoto University of Advanced Science' ? (
                <select 
                  value={program} 
                  onChange={e => setProgram(e.target.value)} 
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all appearance-none"
                  style={{ 
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em'
                  }}
                >
                  <option value="" disabled>Select your program</option>
                  {getPrograms().map((prog) => (
                    <option key={prog} value={prog} className="bg-gray-800 text-white">
                      {prog}
                    </option>
                  ))}
                </select>
              ) : university === 'Other' ? (
                <input 
                  placeholder="Enter your program/major" 
                  value={program} 
                  onChange={e => setProgram(e.target.value)} 
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                />
              ) : (
                <input 
                  placeholder="Please select a university first" 
                  value={program} 
                  disabled
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white/50 placeholder-white/30 cursor-not-allowed"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">Graduation Year</label>
              <input 
                placeholder="e.g. 2025" 
                value={graduationYear} 
                onChange={e=>setGraduationYear(e.target.value)} 
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/90 mb-2">University</label>
              <select 
                value={university} 
                onChange={e => handleUniversityChange(e.target.value)} 
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all appearance-none"
                style={{ 
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: 'right 0.5rem center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '1.5em 1.5em'
                }}
                required
              >
                <option value="" disabled>Select your university</option>
                <option value="Kyoto University of Advanced Science" className="bg-gray-800 text-white">
                  Kyoto University of Advanced Science
                </option>
                <option value="Other" className="bg-gray-800 text-white">
                  Other
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Email</label>
            <input 
              placeholder="Enter your email" 
              type="email" 
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              required 
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-white/90 mb-2">Password</label>
            <input 
              placeholder="Create a password" 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          <button 
            disabled={loading} 
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            type="submit"
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-white/70">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-indigo-300 hover:text-indigo-200 font-medium hover:underline transition-colors">
              Sign In
            </Link>
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-white/50">
            By using this app, you agree to our{' '}
            <a href="#" className="text-indigo-300 hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
