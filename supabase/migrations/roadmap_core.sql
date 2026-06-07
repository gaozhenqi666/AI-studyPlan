create table if not exists public.roadmaps (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  mode text not null default 'learn' check (mode in ('sprint', 'learn')),
  timezone text not null default 'Asia/Shanghai',
  pass_score integer not null default 60,
  default_block_minutes integer not null default 60,
  default_pomodoro_minutes integer not null default 25,
  default_break_minutes integer not null default 5,
  weekly_exam_enabled boolean not null default false,
  weekly_exam_dow integer null check (weekly_exam_dow between 0 and 6),
  weekly_exam_time time null,
  monthly_exam_enabled boolean not null default false,
  monthly_exam_day integer null check (monthly_exam_day between 1 and 31),
  monthly_exam_last boolean not null default false,
  monthly_exam_time time null,
  exam_template jsonb not null default jsonb_build_object(
    'types',
    jsonb_build_array(
      jsonb_build_object('type', 'single', 'count', 10, 'score_per', 5),
      jsonb_build_object('type', 'multi', 'count', 5, 'score_per', 6),
      jsonb_build_object('type', 'blank', 'count', 5, 'score_per', 4),
      jsonb_build_object('type', 'calc', 'count', 4, 'score_per', 10),
      jsonb_build_object('type', 'comprehensive', 'count', 1, 'score_per', 20)
    )
  ),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists roadmaps_user_id_idx on public.roadmaps (user_id);

create table if not exists public.roadmap_nodes (
  id uuid primary key default extensions.uuid_generate_v4(),
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid null references public.roadmap_nodes (id) on delete cascade,
  node_type text not null check (node_type in ('stage', 'block', 'pomodoro', 'exam', 'review')),
  title text not null,
  order_index integer not null default 0,
  planned_minutes integer null,
  planned_start_date date null,
  planned_end_date date null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  metadata jsonb null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists roadmap_nodes_roadmap_id_idx on public.roadmap_nodes (roadmap_id);
create index if not exists roadmap_nodes_user_id_idx on public.roadmap_nodes (user_id);
create index if not exists roadmap_nodes_parent_id_idx on public.roadmap_nodes (parent_id);

create table if not exists public.roadmap_exams (
  id uuid primary key default extensions.uuid_generate_v4(),
  roadmap_id uuid not null references public.roadmaps (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  source_node_id uuid null references public.roadmap_nodes (id) on delete set null,
  exam_type text not null check (exam_type in ('weekly', 'monthly', 'stage', 'manual')),
  scheduled_at timestamp with time zone not null,
  scheduled_local_date date not null,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'skipped')),
  pass_score integer not null default 60,
  score integer null,
  template jsonb not null,
  scope jsonb null,
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists roadmap_exams_unique_schedule_idx
  on public.roadmap_exams (roadmap_id, exam_type, scheduled_local_date)
  where source_node_id is null;

create unique index if not exists roadmap_exams_unique_stage_idx
  on public.roadmap_exams (roadmap_id, source_node_id)
  where source_node_id is not null;

create index if not exists roadmap_exams_user_id_idx on public.roadmap_exams (user_id);
create index if not exists roadmap_exams_roadmap_id_idx on public.roadmap_exams (roadmap_id);

create table if not exists public.roadmap_exam_questions (
  id uuid primary key default extensions.uuid_generate_v4(),
  exam_id uuid not null references public.roadmap_exams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_type text not null,
  question_content text not null,
  options jsonb null,
  user_answer text null,
  correct_answer text null,
  ai_analysis text null,
  is_correct boolean null,
  score integer null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists roadmap_exam_questions_exam_id_idx on public.roadmap_exam_questions (exam_id);
create index if not exists roadmap_exam_questions_user_id_idx on public.roadmap_exam_questions (user_id);

alter table public.roadmaps enable row level security;
alter table public.roadmap_nodes enable row level security;
alter table public.roadmap_exams enable row level security;
alter table public.roadmap_exam_questions enable row level security;

drop policy if exists "roadmaps_rw_own" on public.roadmaps;
create policy "roadmaps_rw_own" on public.roadmaps
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "roadmap_nodes_rw_own" on public.roadmap_nodes;
create policy "roadmap_nodes_rw_own" on public.roadmap_nodes
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "roadmap_exams_rw_own" on public.roadmap_exams;
create policy "roadmap_exams_rw_own" on public.roadmap_exams
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "roadmap_exam_questions_rw_own" on public.roadmap_exam_questions;
create policy "roadmap_exam_questions_rw_own" on public.roadmap_exam_questions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_updated_at_roadmaps on public.roadmaps;
create trigger set_updated_at_roadmaps
before update on public.roadmaps
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_roadmap_nodes on public.roadmap_nodes;
create trigger set_updated_at_roadmap_nodes
before update on public.roadmap_nodes
for each row
execute function public.set_updated_at();

drop trigger if exists set_updated_at_roadmap_exams on public.roadmap_exams;
create trigger set_updated_at_roadmap_exams
before update on public.roadmap_exams
for each row
execute function public.set_updated_at();
