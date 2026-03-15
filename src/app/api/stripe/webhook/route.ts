import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeSecret) {
    console.error("[stripe webhook] STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY missing");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    console.error("[stripe webhook] Supabase not configured");
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? (session.metadata as { user_id?: string } | null)?.user_id;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

      if (!userId) {
        console.error("[stripe webhook] checkout.session.completed: no user_id");
        return NextResponse.json({ received: true });
      }

      let expiresAt: string | null = null;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId) as { current_period_end?: number };
        if (sub.current_period_end) {
          expiresAt = new Date(sub.current_period_end * 1000).toISOString();
        }
      }

      await (supabase.from("user_plan") as unknown as { upsert: (v: object, o?: { onConflict: string }) => Promise<unknown> }).upsert(
        {
          user_id: userId,
          plan: "pro",
          expires_at: expiresAt,
          stripe_subscription_id: subId ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      const { data: rows } = await supabase.from("user_plan").select("user_id").eq("stripe_subscription_id", sub.id);
      const row = Array.isArray(rows) ? rows[0] : (rows as { user_id: string }[] | null)?.[0];
      const periodEnd = (sub as { current_period_end?: number }).current_period_end;
      if (row?.user_id) {
        const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
        const planTable = supabase.from("user_plan") as unknown as { update: (v: object) => { eq: (k: string, v: string) => Promise<unknown> } };
        await planTable.update({ expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("user_id", row.user_id);
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const { data: rows } = await supabase.from("user_plan").select("user_id").eq("stripe_subscription_id", sub.id);
      const row = Array.isArray(rows) ? rows[0] : (rows as { user_id: string }[] | null)?.[0];
      if (row?.user_id) {
        const planTable = supabase.from("user_plan") as unknown as { update: (v: object) => { eq: (k: string, v: string) => Promise<unknown> } };
        await planTable
          .update({
            plan: "free",
            expires_at: null,
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", row.user_id);
      }
    }
  } catch (e) {
    console.error("[stripe webhook] Handler error:", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
