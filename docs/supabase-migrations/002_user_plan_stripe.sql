-- user_plan에 Stripe 구독 ID 추가 (웹훅에서 구독 해지 시 사용자 찾기용)
ALTER TABLE public.user_plan
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_plan_stripe_sub_id
  ON public.user_plan(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
