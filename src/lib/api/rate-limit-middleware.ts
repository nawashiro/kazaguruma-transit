import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "./rate-limit";

export async function appRouterRateLimitMiddleware(
  req: NextRequest,
): Promise<NextResponse | undefined> {
  const result = await checkRateLimit(getClientIp(req.headers));
  if (!result.allowed) {
    return NextResponse.json(
      { success: false, error: result.error, limitExceeded: true },
      { status: 429 },
    );
  }
}

export async function apiRateLimitMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void,
) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded
      ? forwarded.split(",")[0].trim()
      : "x-forwarded-for" in req.headers
        ? req.socket?.remoteAddress || "0.0.0.0"
        : "0.0.0.0";
  const result = await checkRateLimit(ip);
  if (!result.allowed) {
    return res.status(429).json({ success: false, error: result.error, limitExceeded: true });
  }
  return next();
}

export function withRateLimit(
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void,
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    await apiRateLimitMiddleware(req, res, () => handler(req, res));
  };
}
