import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { join } from "path";
import router from "./routes/index.js";

const app: Express = express();

app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

app.use(compression());

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down" },
  skip: (req) => req.path === "/api/healthz",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts, try again in 15 minutes" },
});

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests, please slow down" },
});

app.use(globalLimiter);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    writeLimiter(req, _res, next);
  } else {
    next();
  }
});

app.use("/api/uploads", express.static(join(process.cwd(), "uploads")));
app.use("/api", router);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  if (err && typeof err === "object" && "code" in err) {
    const pgErr = err as { code: string; constraint?: string };
    if (pgErr.code === "23505") {
      const constraint = pgErr.constraint ?? "";
      if (constraint.includes("username")) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }
      if (constraint.includes("email")) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      res.status(409).json({ error: "A record with that value already exists" });
      return;
    }
    if (pgErr.code === "23503") {
      res.status(400).json({ error: "Referenced record does not exist" });
      return;
    }
    if (pgErr.code === "23502") {
      res.status(400).json({ error: "Missing required field" });
      return;
    }
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[error]", message);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
