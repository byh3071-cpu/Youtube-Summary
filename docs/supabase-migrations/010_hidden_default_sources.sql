-- 사용자가 숨긴(삭제한) 기본 YouTube 채널 ID 저장
-- 기본 채널은 코드 상수(defaultSources)라 행 삭제가 불가능하므로,
-- "숨김 ID 목록"을 빼기 집합으로 병합해 삭제처럼 동작시킨다.
CREATE TABLE IF NOT EXISTS public.hidden_default_sources (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source_id)
);

ALTER TABLE public.hidden_default_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own hidden_default_sources"
  ON public.hidden_default_sources FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own hidden_default_sources"
  ON public.hidden_default_sources FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own hidden_default_sources"
  ON public.hidden_default_sources FOR DELETE
  USING (auth.uid() = user_id);
