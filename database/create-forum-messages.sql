-- Forum messages table for course forums
CREATE TABLE forum_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- courses.id is defined as text in the schema (see supabase.sql), so use text here to match
  course_id text REFERENCES courses(id) ON DELETE CASCADE,
  -- user accounts in Supabase are stored in auth.users and use uuid
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name text,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for faster retrieval by course
CREATE INDEX idx_forum_messages_course_id ON forum_messages(course_id);

-- Index for sorting by time
CREATE INDEX idx_forum_messages_created_at ON forum_messages(created_at);
