import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface NotificationEvent {
  userId: string;
  title: string;
  content: string;
  type: string;
  objectType?: string;
  objectId?: string;
  link?: string;
}

export async function enqueueNotifications(db: Db, events: NotificationEvent[]) {
  if (events.length === 0) {
    return;
  }

  await db.notification.createMany({
    data: events.map((event) => ({
      userId: event.userId,
      title: event.title,
      content: event.content,
      type: event.type,
      objectType: event.objectType,
      objectId: event.objectId,
      link: event.link
    }))
  });
}

