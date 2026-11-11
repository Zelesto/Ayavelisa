import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import path from "node:path";

const prisma = new PrismaClient();
const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });
const STATE_ID = "workspace";

const SaveStateBody = z.object({
  version: z.number().int().nonnegative(),
  state: z.record(z.string(), z.unknown()),
});

await app.register(helmet, { contentSecurityPolicy: false });
await app.register(cors, { origin: true });

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
  const saved = await prisma.appState.findUnique({ where: { id: STATE_ID } });
  if (!saved) return { state: null, version: 0 };
  return { state: saved.data, version: saved.version };
});

app.put("/api/state", async (request, reply) => {
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
