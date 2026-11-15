import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { adminJson, getSupabaseAdmin, isSameOrigin, requireAdmin } from "./admin-push";

export { adminJson, getSupabaseAdmin, isSameOrigin, requireAdmin };

export const AD_BUCKET = "ad-assets";
export const AD_SLOTS = ["banner", "floating", "popup"] as const;
export type AdSlot = (typeof AD_SLOTS)[number];

export function isAdSlot(value: unknown): value is AdSlot {
  return typeof value === "string" && AD_SLOTS.includes(value as AdSlot);
}

export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1500) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function getSessionHash(request: NextRequest): string {
  const existing = request.cookies.get("ngipen_ad_session")?.value;
  const token = existing && /^[a-f0-9]{64}$/i.test(existing)
    ? existing
    : crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return createHash("sha256").update(token).digest("hex");
}

export function scheduleStatus(status: string, startsAt: string, endsAt: string) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "invalid";
  if (status === "paused" || status === "completed" || status === "draft") return status;
  if (now < start) return "scheduled";
  if (now >= end) return "completed";
  return "active";
}

export function attachAdSessionCookie<T extends Response>(response: T, request: NextRequest) {
  if (!request.cookies.get("ngipen_ad_session")?.value) {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    response.headers.append("Set-Cookie", `ngipen_ad_session=${token}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly`);
  }
  return response;
}
