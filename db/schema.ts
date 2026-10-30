import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()),
    job: text("job").notNull(),
    instructions: text("instructions"),
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("bots_user_id_idx").on(table.userId)],
);

export const chatKindEnum = pgEnum("chat_kind", ["direct", "group"]);

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    kind: chatKindEnum("kind").notNull().default("direct"),
    name: text("name"),
    lastMessagesPreview: text("last_messages_preview"),
    lastMessageAt: timestamp("last_message_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("chats_user_id_idx").on(table.userId)],
);

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.botId] }),
    index("chat_members_bot_id_idx").on(table.botId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("messages_chat_id_idx").on(table.chatId)],
);

export const usageLedgers = pgTable(
  "usage_ledgers",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(),
    botId: text("bot_id").references(() => bots.id, { onDelete: "set null" }),
    chatId: text("chat_id").references(() => chats.id, { onDelete: "cascade" }),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    sandboxDurationSeconds: integer("sandbox_duration_seconds").notNull().default(0),
    estimatedCostUsd: real("estimated_cost_usd").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_ledgers_user_id_idx").on(table.userId),
    index("usage_ledgers_chat_id_idx").on(table.chatId),
    index("usage_ledgers_bot_id_idx").on(table.botId),
  ],
);

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
  usageLedgers: many(usageLedgers),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
  messages: many(messages),
  usageLedgers: many(usageLedgers),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

export const usageLedgersRelations = relations(usageLedgers, ({ one }) => ({
  chat: one(chats, {
    fields: [usageLedgers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [usageLedgers.botId],
    references: [bots.id],
  }),
}));

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, {
    fields: [chatMembers.chatId],
    references: [chats.id],
  }),
  bot: one(bots, {
    fields: [chatMembers.botId],
    references: [bots.id],
  }),
}));

export const botInsertSchema = createInsertSchema(bots, {
  name: (schema) =>
    schema.min(1, "Name is required").max(64, "Name is too long").trim(),
  job: (schema) =>
    schema.min(1, "Job is required").max(256, "Job is too long").trim(),
  instructions: (schema) =>
    schema.max(1024, "Instructions are too long").trim().optional(),
  avatar: (schema) => schema.min(1, "Avatar is required").trim(),
}).omit({
  id: true,
  userId: true,
  sandboxId: true,
  createdAt: true,
});

export type BotInsert = z.infer<typeof botInsertSchema>;
export type Bot = typeof bots.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type ChatMember = typeof chatMembers.$inferSelect;
export type DBMessage = typeof messages.$inferSelect;
export type UsageLedger = typeof usageLedgers.$inferSelect;
export type UsageLedgerInsert = typeof usageLedgers.$inferInsert;
export const usageLedgerInsertSchema = createInsertSchema(usageLedgers);
