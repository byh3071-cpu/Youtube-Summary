-- 011_usage_atomic_increment.sql
--
-- 사용량 카운터를 원자적으로 증가시키는 RPC.
-- 기존 앱 코드는 select → (앱에서 +1 계산) → upsert 방식이라, 동시 요청에서
-- 여러 요청이 같은 값을 읽고 같은 값을 쓰는 lost update가 발생해 카운트가 실제보다
-- 적게 올라갔다(= 무료 한도가 사실상 무제한). 로컬 부하 검증에서 100회 병렬 증가 시
-- 구 방식은 6까지밖에 안 올라간 반면, 이 RPC는 정확히 100으로 올라간다.
--
-- INSERT ... ON CONFLICT DO UPDATE 단일 문장으로 읽기-수정-쓰기를 DB 레벨에서 원자화한다.
-- 적용: Supabase SQL Editor에서 이 파일을 실행. plan.ts의 increment_usage 호출보다 먼저 적용해야 한다.

create or replace function public.increment_usage(
  p_user_id uuid,
  p_date text,
  p_kind text
)
returns table(summary_count int, insight_count int, briefing_count int, feed_qa_count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.usage_daily as u
    (user_id, date, summary_count, insight_count, briefing_count, feed_qa_count, updated_at)
  values (
    p_user_id, p_date,
    (p_kind = 'summary')::int,
    (p_kind = 'insight')::int,
    (p_kind = 'briefing')::int,
    (p_kind = 'feed_qa')::int,
    now()
  )
  on conflict (user_id, date) do update set
    summary_count  = u.summary_count  + (p_kind = 'summary')::int,
    insight_count  = u.insight_count  + (p_kind = 'insight')::int,
    briefing_count = u.briefing_count + (p_kind = 'briefing')::int,
    feed_qa_count  = u.feed_qa_count  + (p_kind = 'feed_qa')::int,
    updated_at     = now()
  returning u.summary_count, u.insight_count, u.briefing_count, u.feed_qa_count;
end;
$$;

-- 서버(service_role)에서만 호출한다. 앱의 anon/authenticated 경로에는 노출하지 않는다.
revoke all on function public.increment_usage(uuid, text, text) from public;
revoke all on function public.increment_usage(uuid, text, text) from anon;
revoke all on function public.increment_usage(uuid, text, text) from authenticated;
grant execute on function public.increment_usage(uuid, text, text) to service_role;

-- PostgREST가 새 함수를 즉시 인식하도록 스키마 캐시를 리로드한다.
-- (없으면 적용 직후 잠시 rpc가 PGRST202 함수-없음으로 실패할 수 있다.)
notify pgrst, 'reload schema';
