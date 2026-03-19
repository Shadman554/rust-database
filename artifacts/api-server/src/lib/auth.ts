import { createHmac, randomBytes, timingSafeEqual, pbkdf2 } from "crypto";
import { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable must be set in production");
}
const SECRET = JWT_SECRET ?? "vetstan-dev-secret-do-not-use-in-production";

const PBKDF2_ITERATIONS = 120_000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

// Precomputed dummy hash used when a user is not found, so login timing
// is constant regardless of whether the username exists.
const DUMMY_HASH = `pbkdf2:${PBKDF2_ITERATIONS}:${"0".repeat(64)}:${"0".repeat(128)}`;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = 4 - (padded.length % 4);
  return Buffer.from(padding < 4 ? padded + "=".repeat(padding) : padded, "base64").toString("utf8");
}

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

export function signJwt(payload: Omit<JwtPayload, "iat" | "exp">): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + 86400 * 7 }));
  const sig = base64url(
    createHmac("sha256", SECRET)
      .update(`${header}.${body}`)
      .digest()
  );
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const expectedSig = base64url(
      createHmac("sha256", SECRET)
        .update(`${header}.${body}`)
        .digest()
    );
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
    const payload = JSON.parse(base64urlDecode(body)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(32).toString("hex");
  const hash = await new Promise<string>((resolve, reject) => {
    pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
  return `pbkdf2:${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

async function runPbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    pbkdf2(password, salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (!stored.startsWith("pbkdf2:")) {
      return false;
    }
    const [, iterStr, salt, hash] = stored.split(":");
    const iterations = parseInt(iterStr, 10);
    if (!salt || !hash || isNaN(iterations) || iterations < 1) return false;
    const candidate = await runPbkdf2(password, salt, iterations);
    const a = Buffer.from(hash, "hex");
    const b = Buffer.from(candidate, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Runs a full PBKDF2 computation against a dummy hash so that login responses
// take the same amount of time whether or not the username exists (prevents
// username enumeration via timing).
export async function verifyPasswordConstantTime(
  password: string,
  stored: string | null
): Promise<boolean> {
  if (stored === null) {
    await verifyPassword(password, DUMMY_HASH);
    return false;
  }
  return verifyPassword(password, stored);
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.user = payload;
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin only" });
      return;
    }
    next();
  });
}
