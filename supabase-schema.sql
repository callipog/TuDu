-- SQL Schema for Tasks in Supabase

create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  urgency text not null check (urgency in ('low', 'medium', 'high', 'critical')),
  tags text[] default '{}',
  due_date timestamp with time zone,
  completed boolean default false,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.tasks enable row level security;

-- Allow public access for demonstration purposes
-- Note: In a real app, you should restrict this to authenticated users
create policy "Allow public read access"
  on public.tasks for select
  using (true);

create policy "Allow public insert access"
  on public.tasks for insert
  with check (true);

create policy "Allow public update access"
  on public.tasks for update
  using (true);

create policy "Allow public delete access"
  on public.tasks for delete
  using (true);
