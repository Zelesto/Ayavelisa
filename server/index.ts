import Fastify from "fastify";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { Prisma, PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import path from "node:path";

const prisma = new PrismaClient();
const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });
const STATE_ID = "workspace";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const allowedEmails = new Set(
  (process.env.SUPABASE_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

if (process.env.NODE_ENV === "production" && (!supabase || allowedEmails.size === 0)) {
  throw new Error("Production requires SUPABASE_URL, SUPABASE_ANON_KEY, and at least one SUPABASE_ALLOWED_EMAILS entry.");
}

const SaveStateBody = z.object({
  version: z.number().int().nonnegative(),
  state: z.record(z.string(), z.unknown()),
});

await app.register(helmet, { contentSecurityPolicy: false });

app.addHook("preHandler", async (request, reply) => {
  if (request.url.split("?")[0] !== "/api/state") return;
  if (!supabase) {
    if (process.env.NODE_ENV !== "production") return;
    return reply.code(503).send({ error: "authentication_unavailable" });
  }

  const authorization = request.headers.authorization;
  const accessToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return reply.code(401).send({ error: "unauthorized" });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) {
    request.log.warn({ status: error.status }, "Supabase access-token validation failed");
    return reply.code(error.status === 401 ? 401 : 503)
      .send({ error: error.status === 401 ? "unauthorized" : "authentication_unavailable" });
  }
  if (!data.user) return reply.code(401).send({ error: "unauthorized" });

  const email = data.user.email?.toLowerCase();
  if (!email || (allowedEmails.size > 0 && !allowedEmails.has(email))) {
    return reply.code(403).send({ error: "workspace_access_denied" });
  }
});

app.get("/api/health", async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, database: "connected" };
  } catch (error) {
    request.log.error({ err: error }, "Database health check failed");
    return reply.code(503).send({ ok: false, database: "unavailable" });
  }
});

app.get("/api/state", async (_request, reply) => {
  reply.header("Cache-Control", "no-store");
  const saved = await prisma.appState.findUnique({ where: { id: STATE_ID } });
  if (!saved) return { state: null, version: 0 };
  return { state: saved.data, version: saved.version };
});

app.put("/api/state", async (request, reply) => {
  reply.header("Cache-Control", "no-store");
  const parsed = SaveStateBody.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid_state", issues: parsed.error.issues });
  }

  const current = await prisma.appState.findUnique({ where: { id: STATE_ID } });
  if ((current && current.version !== parsed.data.version) || (!current && parsed.data.version !== 0)) {
    return reply.code(409).send({
      error: "state_conflict",
      version: current?.version ?? 0,
    });
  }

  if (!current) {
    try {
      const created = await prisma.appState.create({
        data: { id: STATE_ID, data: parsed.data.state as Prisma.InputJsonValue, version: 1 },
      });
      return { version: created.version };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const latest = await prisma.appState.findUnique({ where: { id: STATE_ID } });
        return reply.code(409).send({ error: "state_conflict", version: latest?.version ?? 0 });
      }
      throw error;
    }
  }

  const updated = await prisma.appState.updateMany({
    where: { id: STATE_ID, version: parsed.data.version },
    data: {
      data: parsed.data.state as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    const latest = await prisma.appState.findUnique({ where: { id: STATE_ID } });
    return reply.code(409).send({ error: "state_conflict", version: latest?.version ?? 0 });
  }
  return { version: parsed.data.version + 1 };
});

if (process.env.NODE_ENV === "production") {
  await app.register(fastifyStatic, {
    root: path.resolve("dist"),
    prefix: "/",
  });
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.type("text/html").sendFile("index.html");
  });
}

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().finally(() => prisma.$disconnect());
  });
}
