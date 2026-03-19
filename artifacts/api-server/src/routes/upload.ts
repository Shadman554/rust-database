import { Router, type IRouter } from "express";
import { createWriteStream, mkdirSync, unlink } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { requireAuth } from "../lib/auth.js";

const router: IRouter = Router();

const UPLOADS_DIR = join(process.cwd(), "uploads");
try { mkdirSync(UPLOADS_DIR, { recursive: true }); } catch {}

// SVG is intentionally excluded: SVGs can contain scripts and would be an XSS
// vector if served from the same origin, even when loaded as an <img> in some
// contexts (e.g. <embed>, <object>, or direct navigation).
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const ALLOWED_MIMES = new Set(Object.keys(MIME_TO_EXT));
const MAX_SIZE = 10 * 1024 * 1024;

function detectMimeFromBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf.length >= 12) {
    const riff = buf.slice(0, 4).toString("ascii");
    const webp = buf.slice(8, 12).toString("ascii");
    if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  }
  return null;
}

router.post("/upload/image", requireAuth, async (req, res): Promise<void> => {
  const contentType = req.headers["content-type"] ?? "";

  if (!contentType.includes("multipart/form-data")) {
    res.status(400).json({ error: "Request must be multipart/form-data" });
    return;
  }

  const boundary = contentType.split("boundary=")[1];
  if (!boundary) {
    res.status(400).json({ error: "No boundary in multipart request" });
    return;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    totalSize += (chunk as Buffer).length;
    if (totalSize > MAX_SIZE) {
      res.status(413).json({ error: "File too large (max 10MB)" });
      return;
    }
    chunks.push(chunk as Buffer);
  }

  const body = Buffer.concat(chunks);
  const boundaryBuf = Buffer.from(`--${boundary}`);

  const parts = splitBuffer(body, boundaryBuf);
  let fileBuffer: Buffer | null = null;
  let declaredMime = "application/octet-stream";

  for (const part of parts) {
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd).toString();
    if (!headers.includes("filename=")) continue;

    const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
    if (contentTypeMatch) declaredMime = contentTypeMatch[1].trim().toLowerCase();

    fileBuffer = part.slice(headerEnd + 4, part.length - 2);
    break;
  }

  if (!fileBuffer) {
    res.status(400).json({ error: "No file found in request" });
    return;
  }

  const detectedMime = detectMimeFromBytes(fileBuffer);
  if (!detectedMime) {
    res.status(400).json({ error: "Could not determine file type from content" });
    return;
  }

  if (!ALLOWED_MIMES.has(detectedMime)) {
    res.status(400).json({ error: "Invalid file type. Only images are allowed." });
    return;
  }

  if (declaredMime !== "application/octet-stream" && declaredMime !== detectedMime) {
    const normalizedDeclared = declaredMime === "image/jpg" ? "image/jpeg" : declaredMime;
    const normalizedDetected = detectedMime === "image/jpg" ? "image/jpeg" : detectedMime;
    if (normalizedDeclared !== normalizedDetected) {
      res.status(400).json({ error: "Declared content type does not match actual file content" });
      return;
    }
  }

  const ext = MIME_TO_EXT[detectedMime] ?? ".jpg";
  const filename = `${randomBytes(16).toString("hex")}${ext}`;
  const filePath = join(UPLOADS_DIR, filename);

  await new Promise<void>((resolve, reject) => {
    const ws = createWriteStream(filePath);
    ws.write(fileBuffer!);
    ws.end();
    ws.on("finish", resolve);
    ws.on("error", (err) => {
      unlink(filePath, () => {});
      reject(err);
    });
  });

  res.json({
    url: `/api/uploads/${filename}`,
    filename,
  });
});

function splitBuffer(buf: Buffer, separator: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  while (start < buf.length) {
    const idx = buf.indexOf(separator, start);
    if (idx === -1) break;
    if (idx > start) parts.push(buf.slice(start, idx));
    start = idx + separator.length;
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
    else if (buf[start] === 45 && buf[start + 1] === 45) break;
  }
  return parts.filter(p => p.length > 0);
}

export default router;
