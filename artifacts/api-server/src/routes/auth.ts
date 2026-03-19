import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword, verifyPasswordConstantTime, signJwt, requireAuth, type AuthRequest } from "../lib/auth.js";

const router: IRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/auth/register", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const { username, email, password } = body;
  const firstName = typeof body.firstName === "string" ? body.firstName : undefined;
  const lastName = typeof body.lastName === "string" ? body.lastName : undefined;

  if (!username || !email || !password) {
    res.status(400).json({ error: "username, email, and password are required" });
    return;
  }
  if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "username, email, and password must be strings" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }
  if (password.length > 1024) {
    res.status(400).json({ error: "password must be 1024 characters or fewer" });
    return;
  }
  if (username.length < 3 || username.length > 50) {
    res.status(400).json({ error: "username must be between 3 and 50 characters" });
    return;
  }
  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }
  if (email.length > 254) {
    res.status(400).json({ error: "Email address is too long" });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id, username: usersTable.username, email: usersTable.email })
    .from(usersTable)
    .where(or(eq(usersTable.username, username), eq(usersTable.email, email)))
    .limit(1);

  if (existing.length > 0) {
    const conflict = existing[0];
    if (conflict.username === username) {
      res.status(409).json({ error: "Username already taken" });
    } else {
      res.status(409).json({ error: "Email already registered" });
    }
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({ username, email, password: await hashPassword(password), firstName, lastName })
    .returning();

  const token = signJwt({ sub: user.id, username: user.username, role: user.role });
  const { password: _pw, ...safeUser } = user;

  res.status(201).json({ token, user: safeUser });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body as Record<string, unknown>;
  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }
  if (typeof username !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "username and password must be strings" });
    return;
  }

  if (password.length > 1024) {
    res.status(400).json({ error: "password must be 1024 characters or fewer" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  const passwordValid = await verifyPasswordConstantTime(password, user?.password ?? null);
  if (!passwordValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user!.isActive) {
    res.status(401).json({ error: "Account is disabled" });
    return;
  }

  const token = signJwt({ sub: user.id, username: user.username, role: user.role });
  const { password: _pw, ...safeUser } = user;

  res.json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.sub))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

export default router;
