create extension if not exists pg_cron;

create or replace function public.generate_due_roadmap_exams()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  local_now timestamp;
  local_date date;
  local_time time;
  is_last_day boolean;
begin
  for r in
    select *
    from public.roadmaps
    where mode = 'sprint'
  loop
    local_now := timezone(r.timezone, now());
    local_date := local_now::date;
    local_time := local_now::time;

    if r.weekly_exam_enabled
      and r.weekly_exam_dow is not null
      and r.weekly_exam_time is not null
      and extract(dow from local_date)::int = r.weekly_exam_dow
      and local_time >= r.weekly_exam_time
    then
      insert into public.roadmap_exams (
        roadmap_id,
        user_id,
        exam_type,
        scheduled_at,
        scheduled_local_date,
        pass_score,
        template
      )
      values (
        r.id,
        r.user_id,
        'weekly',
        timezone(r.timezone, local_date + r.weekly_exam_time),
        local_date,
        r.pass_score,
        r.exam_template
      )
      on conflict do nothing;
    end if;

    is_last_day := local_date = (date_trunc('month', local_date)::date + interval '1 month - 1 day')::date;

    if r.monthly_exam_enabled
      and r.monthly_exam_time is not null
      and local_time >= r.monthly_exam_time
      and (
        (r.monthly_exam_last and is_last_day)
        or (not r.monthly_exam_last and r.monthly_exam_day is not null and extract(day from local_date)::int = r.monthly_exam_day)
      )
    then
      insert into public.roadmap_exams (
        roadmap_id,
        user_id,
        exam_type,
        scheduled_at,
        scheduled_local_date,
        pass_score,
        template
      )
      values (
        r.id,
        r.user_id,
        'monthly',
        timezone(r.timezone, local_date + r.monthly_exam_time),
        local_date,
        r.pass_score,
        r.exam_template
      )
      on conflict do nothing;
    end if;

    insert into public.roadmap_exams (
      roadmap_id,
      user_id,
      source_node_id,
      exam_type,
      scheduled_at,
      scheduled_local_date,
      pass_score,
      template,
      scope
    )
    select
      r.id,
      r.user_id,
      n.id,
      'stage',
      timezone(r.timezone, local_date + time '00:00:00'),
      local_date,
      r.pass_score,
      r.exam_template,
      jsonb_build_object('source_node_id', n.id, 'type', 'stage')
    from public.roadmap_nodes n
    where n.roadmap_id = r.id
      and n.user_id = r.user_id
      and n.node_type = 'exam'
      and n.status = 'pending'
      and n.planned_start_date is not null
      and n.planned_start_date <= local_date
    on conflict do nothing;
  end loop;
end;
$$;

do $$
declare
  existing_jobid integer;
begin
  select jobid into existing_jobid
  from cron.job
  where jobname = 'roadmap_exam_scheduler';

  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;

  perform cron.schedule(
    'roadmap_exam_scheduler',
    '*/5 * * * *',
    $cmd$select public.generate_due_roadmap_exams();$cmd$
  );
end
$$;
