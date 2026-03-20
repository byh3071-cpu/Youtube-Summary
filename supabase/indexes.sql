-- Focus Feed: 권장 Supabase 인덱스
-- 프로덕션 배포 전에 Supabase SQL Editor에서 실행하세요.

-- summaries: video_id로 캐시 조회 빈번
CREATE INDEX IF NOT EXISTS idx_summaries_video_id ON summaries (video_id);

-- bookmarks: 사용자별 북마크 조회
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks (user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_video ON bookmarks (user_id, video_id);

-- usage_daily: 사용량 조회 (사용자 + 날짜)
CREATE INDEX IF NOT EXISTS idx_usage_daily_user_date ON usage_daily (user_id, date);

-- user_plan: stripe_subscription_id로 웹훅 처리 시 조회
CREATE INDEX IF NOT EXISTS idx_user_plan_stripe_sub ON user_plan (stripe_subscription_id);

-- team_members: 팀별 멤버 조회 / 사용자별 팀 조회
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members (user_id);

-- team_invites: 토큰으로 초대 조회
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites (token);

-- custom_sources: 사용자별 커스텀 소스 조회
CREATE INDEX IF NOT EXISTS idx_custom_sources_user_id ON custom_sources (user_id);

-- trend_cache: 버킷별 최신 트렌드 조회
CREATE INDEX IF NOT EXISTS idx_trend_cache_bucket ON trend_cache (bucket, generated_at DESC);
