-- Users table (Supabase handles auth.users automatically)
-- We'll create a profiles table for additional user data

-- Profiles table for extended user information
create table profiles (
  id uuid references auth.users on delete cascade,
  email text,
  name text,
  program text,
  graduation_year text,
  university_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  primary key (id)
);

-- Ensure columns exist / are aligned if table already created previously
-- Drop legacy year_of_study column if present
alter table if exists profiles drop column if exists year_of_study;
-- Add program if missing
alter table if exists profiles add column if not exists program text;
-- Add graduation_year if missing
alter table if exists profiles add column if not exists graduation_year text;
-- Add university_name if missing
alter table if exists profiles add column if not exists university_name text;
-- If an old faculty column exists, migrate values into program then drop it
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name = 'profiles' and column_name = 'faculty'
  ) then
    -- Create program column if still missing
    if not exists (
      select 1 from information_schema.columns 
      where table_name = 'profiles' and column_name = 'program'
    ) then
      execute 'alter table profiles add column program text';
    end if;
    -- Copy data
    execute 'update profiles set program = coalesce(program, faculty)';
    -- Drop old column
    execute 'alter table profiles drop column faculty';
  end if;
end $$;

-- Events table for calendar events
create table events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  description text,
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  all_day boolean default false,
  color text default '#3788d8',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User memory summary to store key activities per user
create table if not exists user_memory (
  user_id uuid primary key references auth.users on delete cascade,
  summary_json jsonb not null default '{"activities":[]}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table events enable row level security;
alter table user_memory enable row level security;

-- Profiles policies
create policy "Users can view own profile" 
  on profiles for select 
  using (auth.uid() = id);

create policy "Users can update own profile" 
  on profiles for update 
  using (auth.uid() = id);

create policy "Users can insert own profile" 
  on profiles for insert 
  with check (auth.uid() = id);

-- Events policies  
create policy "Users can view own events" 
  on events for select 
  using (auth.uid() = user_id);

create policy "Users can insert own events" 
  on events for insert 
  with check (auth.uid() = user_id);

create policy "Users can update own events" 
  on events for update 
  using (auth.uid() = user_id);

create policy "Users can delete own events" 
  on events for delete 
  using (auth.uid() = user_id);

-- User memory policies
create policy if not exists "Users can view own memory"
  on user_memory for select
  using (auth.uid() = user_id);

create policy if not exists "Users can insert own memory"
  on user_memory for insert
  with check (auth.uid() = user_id);

create policy if not exists "Users can update own memory"
  on user_memory for update
  using (auth.uid() = user_id);

-- Function to handle user profile creation
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name, program, graduation_year, university_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    coalesce(new.raw_user_meta_data->>'program', new.raw_user_meta_data->>'faculty'),
    new.raw_user_meta_data->>'graduation_year',
    new.raw_user_meta_data->>'university_name'
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    program = excluded.program,
    graduation_year = excluded.graduation_year,
    university_name = excluded.university_name,
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
