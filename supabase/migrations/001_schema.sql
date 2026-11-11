-- Neonatal breathing observation survey: private response store.
-- Apply this migration in the Supabase SQL editor or with supabase db push.
create extension if not exists pgcrypto;
create table if not exists public.study_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  added_by text
);
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null unique,
  submitted_at timestamptz not null default now(),
  clinical_role text,
  neonatal_experience text,
  presentation_order jsonb not null,
  responses jsonb not null,
  final_questions jsonb not null default '{}'::jsonb,
  consent_given boolean not null default false,
  consent_version text not null,
  client_version text,
  is_test boolean not null default false,
  constraint submissions_eight_responses check (jsonb_typeof(responses) = 'array' and jsonb_array_length(responses) = 8),
  constraint submissions_order_array check (jsonb_typeof(presentation_order) = 'array' and jsonb_array_length(presentation_order) = 8),
  constraint submissions_final_questions_object check (jsonb_typeof(final_questions) = 'object')
);
create index if not exists submissions_submitted_at_idx on public.submissions (submitted_at desc);
create index if not exists submissions_is_test_idx on public.submissions (is_test);
alter table public.study_admins enable row level security;
alter table public.submissions enable row level security;
revoke all on public.submissions from anon, authenticated;
grant select on public.submissions to authenticated;
revoke all on public.study_admins from anon, authenticated;
create or replace function public.is_study_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.study_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_study_admin() from public, anon;
grant execute on function public.is_study_admin() to authenticated;
create policy "study administrators can read submissions"
on public.submissions for select to authenticated using (public.is_study_admin());
create or replace function public.submit_complete_survey(p_submission jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_participant_id uuid;
  v_responses jsonb;
  v_order jsonb;
  v_distinct_count integer;
begin
  if coalesce((p_submission->>'consent_given')::boolean, false) is not true then raise exception 'Consent is required'; end if;
  v_participant_id := (p_submission->>'participant_id')::uuid;
  v_responses := p_submission->'responses';
  v_order := p_submission->'presentation_order';
  if jsonb_typeof(v_responses) <> 'array' or jsonb_array_length(v_responses) <> 8 then raise exception 'Exactly eight scenario responses are required'; end if;
  if jsonb_typeof(v_order) <> 'array' or jsonb_array_length(v_order) <> 8 then raise exception 'The eight-scenario presentation order is required'; end if;
  select count(distinct value->>'scenario_id') into v_distinct_count from jsonb_array_elements(v_responses);
  if v_distinct_count <> 8 then raise exception 'Scenario responses must have eight unique scenario IDs'; end if;
  if exists (select 1 from jsonb_array_elements(v_responses) as r(value)
    where coalesce(r.value->>'scenario_id','') not in ('baby-01','baby-02','baby-03','baby-04','baby-05','baby-06','baby-07','baby-08')) then raise exception 'Unknown scenario ID'; end if;
  if exists (select 1 from jsonb_array_elements(v_responses) as r(value)
    where coalesce(r.value->>'final_rating','') not in ('green','yellow','red')
       or coalesce(r.value->>'first_rating','') not in ('green','yellow','red')
       or coalesce((r.value->>'confidence')::integer, 0) not between 1 and 5) then
    raise exception 'Each scenario requires a valid first rating, final rating, and confidence score';
  end if;
  insert into public.submissions (participant_id, clinical_role, neonatal_experience, presentation_order, responses, final_questions, consent_given, consent_version, client_version, is_test)
  values (v_participant_id, nullif(left(coalesce(p_submission->>'clinical_role',''),120),''), nullif(left(coalesce(p_submission->>'neonatal_experience',''),120),''),
    v_order, v_responses, coalesce(p_submission->'final_questions','{}'::jsonb), true,
    left(coalesce(p_submission->>'consent_version','unspecified'),80), left(coalesce(p_submission->>'client_version',''),40),
    coalesce((p_submission->>'is_test')::boolean,false))
  on conflict (participant_id) do nothing;
  select id into v_id from public.submissions where participant_id = v_participant_id;
  return v_id;
end;
$$;
revoke all on function public.submit_complete_survey(jsonb) from public, anon, authenticated;
grant execute on function public.submit_complete_survey(jsonb) to service_role;
