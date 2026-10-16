import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";

export async function writeAudit(session: Session, params: { logEntryId: string; action: AuditAction; before?: unknown; after?: unknown }) {
  await prisma.auditLog.create({
    data: {
      logEntryId: params.logEntryId,
      action: params.action,
      userId: session.user?.id,
      userName: session.user?.name ?? session.user?.email ?? "Неизвестно",
      before: params.before === undefined ? undefined : (params.before as object),
      after: params.after === undefined ? undefined : (params.after as object),
    },
  });
}

export function getLogAudit(logEntryId: string) {
  return prisma.auditLog.findMany({ where: { logEntryId }, orderBy: { createdAt: "desc" } });
}
