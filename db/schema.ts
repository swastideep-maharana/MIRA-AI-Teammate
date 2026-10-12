import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
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
