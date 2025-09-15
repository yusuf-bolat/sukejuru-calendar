-- Additional tables for chat memory and courses catalog

create table if not exists chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references chat_sessions on delete cascade,
  user_id uuid references auth.users on delete cascade not null,
  role text check (role in ('system','user','assistant')) not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists courses (
  id text primary key,
  course text,
  short_name text,
  semester int,
  level text,
  lecture_credits int,
  exercise_credits int,
  lecture jsonb,
  exercise jsonb
);

alter table chat_sessions enable row level security;
alter table messages enable row level security;
alter table courses enable row level security;

create policy "Users view own chat sessions" on chat_sessions for select using (auth.uid() = user_id);
create policy "Users manage own chat sessions" on chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users view own messages" on messages for select using (auth.uid() = user_id);
create policy "Users insert own messages" on messages for insert with check (auth.uid() = user_id);

create policy "Courses readable by all" on courses for select using (true);
create policy "Courses upsert by admins only" on courses for insert with check (false);
