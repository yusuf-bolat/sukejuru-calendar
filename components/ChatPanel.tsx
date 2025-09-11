import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export function ChatPanel() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{role:'user'|'assistant',content:string}[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingOptimization, setPendingOptimization] = useState<any>(null)
  const [userName, setUserName] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: prof } = await supabase.from('profiles').select('name, email').eq('id', session.user.id).single()
          const name = prof?.name || session.user.email?.split('@')[0] || 'there'
          setUserName(name)
          setMessages([{ 
            role: 'assistant', 
            content: `Hi ${name}, how can I help you today? I can assist with schedule management, course recommendations, and answering questions about the website features.` 
          }])
        }
      } catch (error) {
        console.error('Error loading user:', error)
        setMessages([{ 
          role: 'assistant', 
          content: 'Hi there, how can I help you today? I can assist with schedule management, course recommendations, and answering questions about the website features.' 
        }])
      }
    }
    loadUser()
  }, [])

  useEffect(()=>{ scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }) }, [messages])

  const append = (role: 'user'|'assistant', content: string) => setMessages(prev => [...prev, { role, content }])

  const applyOptimization = async (optimizedBlocks: any[]) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in')
      
      const res = await fetch('/api/apply-optimization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ optimized_blocks: optimizedBlocks })
      })
      
      if (!res.ok) throw new Error('Failed to apply optimization')
      
      const result = await res.json()
      window.dispatchEvent(new CustomEvent('calendar:reload'))
      return result
    } catch (error) {
      throw error
    }
  }

  const send = async () => {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    append('user', content)
    setLoading(true)
    
    try {
      // Check if user is agreeing to apply optimization
      if (pendingOptimization && (content.toLowerCase().includes('yes') || content.toLowerCase().includes('apply'))) {
        try {
          const result = await applyOptimization(pendingOptimization.optimized_blocks)
          append('assistant', `✅ ${result.message}`)
          setPendingOptimization(null)
          setLoading(false)
          return
        } catch (e: any) {
          append('assistant', `❌ Failed to apply optimization: ${e.message}`)
          setPendingOptimization(null)
          setLoading(false)
          return
        }
      }
      
      // Get session token for API authentication
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Please sign in to use the chatbot')
      }
      
      const res = await fetch('/api/chat', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }, 
        body: JSON.stringify({ message: content }) 
      })
      
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Please sign in to continue')
        }
        throw new Error('Failed to send message')
      }
      
      const data = await res.json()
      
      // Process the AI response using the new API
      const processRes = await fetch('/api/process-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ aiResponse: data.reply })
      })
      
      if (!processRes.ok) {
        throw new Error('Failed to process response')
      }
      
      const processedData = await processRes.json()
      setLoading(false)

      // Handle different response types
      if (processedData.type === 'text') {
        // Regular text response
        append('assistant', processedData.content)
      } else if (processedData.type === 'calendar_action') {
        // Calendar action was processed
        let summary = processedData.summary
        
        if (processedData.assignments > 0) {
          summary += `\n\n📝 **${processedData.assignments} assignments added to your todo list!** Check the Todo tab to manage them.`
        }
        
        append('assistant', summary)
        
        // Reload calendar to show new events
        if (processedData.calendarEvents > 0) {
          window.dispatchEvent(new CustomEvent('calendar:reload'))
        }
      } else if (processedData.type === 'command_action') {
        // Command action was processed
        append('assistant', `✅ ${processedData.summary}`)
        
        // Reload calendar and todo list for certain commands
        if (['reschedule_meeting', 'delete_course', 'delete_meeting', 'cancel_last_change'].includes(processedData.command)) {
          window.dispatchEvent(new CustomEvent('calendar:reload'))
        }
      } else {
        // Handle other response types (like schedule analysis)
        let handled = false
        try {
          const obj = processedData.content
          if (obj && obj.action) {
            handled = true
            
            if (obj.action === 'schedule-analysis') {
              // Handle enhanced schedule analysis response
              let analysisResponse = "📊 **Schedule Analysis Results:**\n\n"
              
              if (obj.current_status) {
                analysisResponse += `**Current Status:** ${obj.current_status.charAt(0).toUpperCase() + obj.current_status.slice(1)}\n`
              }
              
              if (obj.total_weekly_hours) {
                analysisResponse += `**Total Weekly Hours:** ${obj.total_weekly_hours} hours\n`
              }
              
              if (obj.academic_load) {
                analysisResponse += `**Academic Load:** ${obj.academic_load.charAt(0).toUpperCase() + obj.academic_load.slice(1)}\n\n`
              }
              
              if (obj.issues && obj.issues.length > 0) {
                analysisResponse += "⚠️ **Issues Found:**\n"
                obj.issues.forEach((issue: string, index: number) => {
                  analysisResponse += `${index + 1}. ${issue}\n`
                })
                analysisResponse += "\n"
              } else {
                analysisResponse += "✅ **No major issues found in your schedule!**\n\n"
              }
              
              if (obj.recommendations && obj.recommendations.length > 0) {
                analysisResponse += "💡 **Recommendations:**\n"
                obj.recommendations.forEach((rec: string, index: number) => {
                  analysisResponse += `${index + 1}. ${rec}\n`
                })
                analysisResponse += "\n"
              }
              
              if (obj.optimized_blocks && obj.optimized_blocks.length > 0) {
                analysisResponse += "🎯 **Suggested Schedule Blocks:**\n"
                obj.optimized_blocks.forEach((block: any, index: number) => {
                  const priorityEmoji = block.priority === 'high' ? '🔥' : block.priority === 'medium' ? '⚡' : '📌'
                  const typeEmoji = block.type === 'study' ? '📚' : block.type === 'work' ? '💼' : block.type === 'break' ? '☕' : '🎯'
                  
                  analysisResponse += `${index + 1}. ${priorityEmoji} ${typeEmoji} **${block.title}**\n`
                  analysisResponse += `   📅 ${block.suggested_time}`
                  if (block.duration) analysisResponse += ` (${block.duration})`
                  if (block.frequency) analysisResponse += ` - ${block.frequency}`
                  if (block.priority) analysisResponse += ` [${block.priority.toUpperCase()} PRIORITY]`
                  analysisResponse += `\n   💭 ${block.reason}\n\n`
                })
                analysisResponse += "📝 Reply with 'yes' or 'apply changes' to implement these suggestions."
                
                // Store the optimization for potential application
                setPendingOptimization(obj)
              }
              
              append('assistant', analysisResponse)
            } else {
              append('assistant', obj.summary || 'Action completed.')
            }
          }
        } catch (e) {
          handled = false
        }
        
        if (!handled) {
          append('assistant', processedData.content?.toString() || data.reply)
        }
      }
    } catch (e: any) {
      setLoading(false)
      append('assistant', `Error: ${e.message || 'Something went wrong'}`)
    }
  }

  return (
    <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ borderBottom: '1px solid #333', padding: '16px', background: 'rgba(255,255,255,0.03)' }}>
        <h3 style={{ color: '#4fc3f7', margin: 0, fontSize: '18px' }}>🤖 AI Assistant</h3>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '12px' }}>
            <div style={{ 
              color: msg.role === 'user' ? '#4fc3f7' : '#f2f2f2', 
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '4px'
            }}>
              {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
            </div>
            <div style={{ 
              color: '#e0e0e0', 
              background: msg.role === 'user' ? 'rgba(79, 195, 247, 0.1)' : 'rgba(255,255,255,0.05)', 
              padding: '8px 12px', 
              borderRadius: '8px',
              fontSize: '14px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ color: '#aaa', fontStyle: 'italic', fontSize: '14px' }}>
            AI is thinking...
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid #333', padding: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !loading && send()}
            placeholder="Ask me about your schedule..."
            disabled={loading}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid #444',
              borderRadius: '6px',
              color: '#f2f2f2',
              fontSize: '14px'
            }}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="button-primary"
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              opacity: loading || !input.trim() ? 0.5 : 1
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
