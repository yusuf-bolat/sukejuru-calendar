-- Users table (Supabase handles auth.users automatically)
-- We'll create a profiles table for additional user data

-- Profiles table for extended user information
create table profiles (
  id uuid references auth.users on delete cascade,
  email text,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,

  primary key (id)
);

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

-- Enable Row Level Security (RLS)
alter table profiles enable row level security;
alter table events enable row level security;

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

-- Function to handle user profile creation
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile when user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
