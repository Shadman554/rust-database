import { Router, type IRouter } from "express";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const router: IRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SPEC_PATH = resolve(__dirname, "../../../../lib/api-spec/openapi.yaml");

router.get("/openapi.yaml", (_req, res): void => {
  try {
    const spec = readFileSync(SPEC_PATH, "utf-8");
    res.setHeader("Content-Type", "text/yaml; charset=utf-8");
    res.send(spec);
  } catch {
    res.status(500).json({ error: "Could not load OpenAPI spec" });
  }
});

router.get("/docs", (_req, res): void => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VetStan API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; }
    #swagger-ui .topbar { background-color: #1a6b3a; }
    #swagger-ui .topbar-wrapper .link { display: none; }
    #swagger-ui .topbar-wrapper::before {
      content: "🐾 VetStan API";
      color: white;
      font-size: 1.4rem;
      font-weight: bold;
      padding-left: 1rem;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: window.location.origin + "/api/openapi.yaml",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      tryItOutEnabled: true,
      persistAuthorization: true,
      requestInterceptor: (req) => {
        const token = localStorage.getItem("vetstan_token");
        if (token) req.headers["Authorization"] = "Bearer " + token;
        return req;
      },
    });
  </script>
</body>
</html>`);
});

export default router;
