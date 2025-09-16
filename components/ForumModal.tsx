import React, { useEffect, useRef, useState } from 'react';
import { X, Users } from 'lucide-react';
import { CourseWithStats } from '@/types/courses';
import { supabase } from '@/lib/supabaseClient';

interface ForumModalProps {
  course: CourseWithStats;
  onClose: () => void;
}

type ForumMessage = {
  id: string;
  course_id: string;
  sender_id: string | null;
  sender_name: string | null;
  content: string;
  created_at: string;
};

const ForumModal: React.FC<ForumModalProps> = ({ course, onClose }) => {
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const mounted = useRef(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  mounted.current = true;
  // get current user id once
  supabase.auth.getUser().then(res => setCurrentUserId(res.data?.user?.id ?? null)).catch(() => {});
  fetchMessages();

    // subscribe to realtime inserts for this course
    const channel = supabase
      .channel('public:forum_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_messages', filter: `course_id=eq.${course.id}` }, (payload) => {
        const newMessage = payload.new as ForumMessage;
        setMessages(prev => [...prev, newMessage]);
        // scroll to bottom
        requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
      })
      .subscribe()

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    }
  }, [course.id]);

  const fetchMessages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('forum_messages')
      .select('*')
      .eq('course_id', course.id)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) {
      console.error('Error fetching messages', error);
    } else if (data) {
      if (mounted.current) setMessages(data as ForumMessage[]);
      // scroll to bottom after a tick
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }));
    }

    setLoading(false);
  }

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);

  // get current user
  const userResult = await supabase.auth.getUser();
  const user = userResult.data?.user ?? null;
  const sender_id = user?.id ?? null;
  const sender_name = (user?.user_metadata as any)?.full_name ?? (user?.email ?? 'Anonymous');

    const payload = {
      course_id: course.id,
      sender_id,
      sender_name,
      content: input.trim()
    };

    // optimistic UI: append a temp message
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ForumMessage = { id: tempId, course_id: course.id, sender_id, sender_name, content: input.trim(), created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempMsg]);
    setInput('');

  const { data, error } = await supabase.from('forum_messages').insert(payload).select().single();
  if (!currentUserId && sender_id) setCurrentUserId(sender_id);
    if (error) {
      console.error('Send error', error);
      // remove temp message
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else if (data) {
      // replace temp message with real one (if realtime didn't already add it)
      setMessages(prev => {
        const exists = prev.find(m => m.id === data.id);
        if (exists) return prev.map(m => m.id === tempId ? data as ForumMessage : m);
        return prev.map(m => m.id === tempId ? data as ForumMessage : m);
      });
    }

    setSending(false);
    // scroll to bottom
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }));
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl w-full max-w-4xl min-h-[90vh] max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-100">{course.short_name} Forum</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Forum Messages (group chat style) */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {loading ? (
              <div className="text-gray-400">Loading messages...</div>
            ) : (
              <div className="flex flex-col gap-3">
                {messages.map((m) => (
                  <div key={m.id} className={`${m.sender_id === currentUserId ? 'self-end bg-blue-600/80 text-white' : 'self-start bg-gray-700 text-gray-100'} rounded-xl px-4 py-2 max-w-[70%]` }>
                    <div className="text-xs text-gray-400 mb-1">{m.sender_name || 'Anonymous'} · {new Date(m.created_at).toLocaleString()}</div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-700 bg-gray-800 flex items-center gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              type="text"
              placeholder="Type your message..."
              className="flex-1 bg-gray-700 text-gray-100 rounded-full px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-full px-5 py-3 font-semibold shadow-md transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForumModal;
