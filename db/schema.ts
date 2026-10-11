import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const bots = pgTable("bots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  role: text("role").default("teammate"),
  avatarSeed: text("avatar_seed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const botInsertSchema = createInsertSchema(bots, {
  name: (schema) => schema.min(1, "Name is required").max(64, "Name is too long").trim(),
  description: (schema) => schema.max(256, "Description is too long").trim(),
  role: (schema) => schema.max(64),
  avatarSeed: (schema) => schema.max(64),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type BotInsert = z.infer<typeof botInsertSchema>;
export type Bot = typeof bots.$inferSelect;

export const todos = pgTable("todos", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const todoInsertSchema = createInsertSchema(todos, {
  title: (schema) => schema.min(1, "Title is required").max(256, "Title is too long").trim(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export type TodoInsert = z.infer<typeof todoInsertSchema>;
export type Todo = typeof todos.$inferSelect;
