import type { Request, Response, NextFunction } from "express";
import { PrivyClient } from "@privy-io/node";
import { config } from "./config.js";

export type AuthenticatedRequest = Request & { pileupUserId?: string };

// Privy JWT verification belongs here. In demo mode we accept an explicitly marked
// emulator header only; production requests must be verified before deployment.
const privy = config.PRIVY_APP_ID && config.PRIVY_APP_SECRET
  ? new PrivyClient({ appId: config.PRIVY_APP_ID, appSecret: config.PRIVY_APP_SECRET, jwtVerificationKey: config.PRIVY_JWT_VERIFICATION_KEY })
  : undefined;

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.header("x-pileup-demo-user");
  if (process.env.PILEUP_MODE === "demo" && userId) {
    req.pileupUserId = userId;
    next();
    return;
  }
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!privy || !token) return res.status(401).json({ error: "A verified Privy access token is required" });
  try {
    const claims = await privy.utils().auth().verifyAuthToken(token);
    req.pileupUserId = claims.user_id;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired Privy access token" });
  }
}

export function getUserId(req: AuthenticatedRequest): string {
  if (!req.pileupUserId) throw new Error("Missing authenticated user");
  return req.pileupUserId;
}
