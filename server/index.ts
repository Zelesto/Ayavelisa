import Fastify from "fastify";
import helmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import { Prisma, PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

const prisma = new PrismaClient();
const app = Fastify({ logger: true, bodyLimit: 50 * 1024 * 1024 });
const STATE_ID = "workspace";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const bootstrapAdminEmails = new Set(
  (process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
const supabaseAdmin = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const AccountRole = z.enum(["admin", "fieldworker", "supervisor", "reviewer"]);
type AccountRole = z.infer<typeof AccountRole>;
type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: AccountRole;
};

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthenticatedUser | null;
  }
}

if (process.env.NODE_ENV === "production" && (!supabase || bootstrapAdminEmails.size === 0)) {
  throw new Error("Production requires Supabase URL, anon key, and at least one bootstrap admin email.");
}

const SaveStateBody = z.object({
  version: z.number().int().nonnegative(),
  state: z.record(z.string(), z.unknown()),
});
const InviteUserBody = z.object({
  email: z.string().trim().email().max(254),
  name: z.string().trim().min(1).max(120).optional(),
  role: AccountRole,
});
const UpdateUserBody = z.object({
  role: AccountRole.optional(),
  active: z.boolean().optional(),
}).refine((value) => value.role !== undefined || value.active !== undefined);

const editableStateKeys: Record<AccountRole, ReadonlySet<string> | null> = {
  admin: null,
  supervisor: null,
  reviewer: new Set([
    "cases", "visits", "blockers", "activities", "sync", "auditLog",
    "intakes", "beneficiaryLeads", "leadImportBatches",
  ]),
  fieldworker: new Set([
    "visits", "intakes", "beneficiaryLeads", "leadImportBatches",
    "sync", "activities",
  ]),
};

await app.register(helmet, { contentSecurityPolicy: false });

app.decorateRequest("authUser", null);
app.addHook("preHandler", async (request, reply) => {
  const route = request.url.split("?")[0];
  if (!route.startsWith("/api/") || route === "/api/health") return;
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

  const email = data.user.email?.trim().toLowerCase();
  if (!email) return reply.code(403).send({ error: "account_email_required" });

  let account = await prisma.user.findUnique({ where: { id: data.user.id } });
  if (!account && bootstrapAdminEmails.has(email)) {
    try {
      account = await prisma.user.upsert({
        where: { id: data.user.id },
        create: {
          id: data.user.id,
          email,
          name: data.user.user_metadata?.full_name?.toString() || email,
          role: "admin",
          active: true,
        },
        update: {},
      });
    } catch (error) {
      request.log.error({ err: error }, "Could not provision bootstrap administrator");
      return reply.code(503).send({ error: "account_provisioning_failed" });
    }
  }
  if (!account?.email || account.email.toLowerCase() !== email) {
    return reply.code(403).send({ error: "account_not_invited" });
  }
  if (!account.active) return reply.code(403).send({ error: "account_inactive" });
  const role = AccountRole.safeParse(account.role);
  if (!role.success) {
    request.log.error({ userId: account.id }, "Account has an unsupported role");
    return reply.code(403).send({ error: "account_role_invalid" });
  }
  request.authUser = {
    id: account.id,
    email,
    name: account.name,
    role: role.data,
  };
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

app.get("/api/me", async (request, reply) => {
  reply.header("Cache-Control", "no-store");
  if (!request.authUser) {
    if (process.env.NODE_ENV !== "production") return { user: null };
    return reply.code(401).send({ error: "unauthorized" });
  }
  return { user: request.authUser };
});

app.get("/api/admin/users", async (request, reply) => {
  reply.header("Cache-Control", "no-store");
  if (request.authUser?.role !== "admin") {
    return reply.code(403).send({ error: "admin_required" });
  }
  const users = await prisma.user.findMany({
    where: { email: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });
  return { users };
});

app.post("/api/admin/users", async (request, reply) => {
  const actor = request.authUser;
  if (actor?.role !== "admin") return reply.code(403).send({ error: "admin_required" });
  const parsed = InviteUserBody.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid_user", issues: parsed.error.issues });
  }
  if (!supabaseAdmin) return reply.code(503).send({ error: "user_invites_unavailable" });

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) return reply.code(409).send({ error: "account_already_managed" });

  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: parsed.data.name ?? email },
  });
  if (error || !data.user?.id) {
    request.log.warn({ status: error?.status, code: error?.code }, "Supabase invite failed");
    return reply.code(error?.status === 422 ? 409 : 502)
      .send({ error: error?.status === 422 ? "auth_user_already_exists" : "invite_failed" });
  }

  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          id: data.user.id,
          email,
          name: parsed.data.name ?? email,
          role: parsed.data.role,
          active: true,
        },
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      });
      await transaction.userAudit.create({
        data: {
          id: crypto.randomUUID(),
          actorUserId: actor.id,
          subjectUserId: created.id,
          action: "invite",
          after: { id: created.id, email: created.email, name: created.name, role: created.role, active: created.active },
        },
      });
      return created;
    });
    return reply.code(201).send({ user });
  } catch (error) {
    request.log.error({ err: error, invitedUserId: data.user.id }, "Invite sent but account setup failed");
    return reply.code(502).send({ error: "invite_sent_account_setup_failed" });
  }
});

app.patch<{ Params: { id: string } }>("/api/admin/users/:id", async (request, reply) => {
  const actor = request.authUser;
  if (actor?.role !== "admin") return reply.code(403).send({ error: "admin_required" });
  const parsed = UpdateUserBody.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "invalid_user_update", issues: parsed.error.issues });
  }
  if (request.params.id === actor.id && (parsed.data.active === false || parsed.data.role !== undefined && parsed.data.role !== "admin")) {
    return reply.code(400).send({ error: "cannot_remove_own_admin_access" });
  }

  try {
    const updatedUser = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(78112026)`;
      const current = await transaction.user.findUnique({ where: { id: request.params.id } });
      if (!current?.email) return null;

      const nextRole = parsed.data.role ?? current.role;
      const nextActive = parsed.data.active ?? current.active;
      if (current.role === "admin" && current.active && (nextRole !== "admin" || !nextActive)) {
        const activeAdmins = await transaction.user.count({
          where: { role: "admin", active: true, email: { not: null } },
        });
        if (activeAdmins <= 1) throw new Error("last_active_admin");
      }

      const updated = await transaction.user.update({
        where: { id: current.id },
        data: { role: nextRole, active: nextActive },
        select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
      });
      await transaction.userAudit.create({
        data: {
          id: crypto.randomUUID(),
          actorUserId: actor.id,
          subjectUserId: updated.id,
          action: "update",
          before: { role: current.role, active: current.active },
          after: { role: updated.role, active: updated.active },
        },
      });
      return updated;
    });
    if (!updatedUser) return reply.code(404).send({ error: "account_not_found" });
    return { user: updatedUser };
  } catch (error) {
    if (error instanceof Error && error.message === "last_active_admin") {
      return reply.code(409).send({ error: "cannot_remove_last_active_admin" });
    }
    request.log.error({ err: error }, "Could not update account");
    throw error;
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
  const role = request.authUser?.role;
  if (role && !current && role !== "admin" && role !== "supervisor") {
    return reply.code(403).send({ error: "workspace_initialization_requires_supervisor" });
  }
  const editableKeys = role ? editableStateKeys[role] : null;
  if (current && editableKeys) {
    const previousState = current.data as Record<string, unknown>;
    const changedKeys = new Set([...Object.keys(previousState), ...Object.keys(parsed.data.state)]);
    const forbiddenChanges = [...changedKeys].filter((key) =>
      !editableKeys.has(key) && !isDeepStrictEqual(previousState[key], parsed.data.state[key]),
    );
    if (forbiddenChanges.length > 0) {
      return reply.code(403).send({ error: "role_cannot_change_workspace_sections", sections: forbiddenChanges });
    }
  }
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
