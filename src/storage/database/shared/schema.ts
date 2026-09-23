import { pgTable, serial, varchar, text, timestamp, uuid, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

/**
 * 工作室内部人员（与访客数据完全分开存储）
 */
export const internalMembers = pgTable(
  "internal_members",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id").notNull().default(sql`auth.uid()`),
    member_no: varchar("member_no", { length: 32 }),
    name: varchar("name", { length: 128 }).notNull(),
    title: varchar("title", { length: 128 }),
    department: varchar("department", { length: 128 }),
    email: varchar("email", { length: 255 }),
    bio: text("bio"),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("internal_members_user_id_idx").on(table.user_id),
    index("internal_members_status_idx").on(table.status),
  ]
);

// 工号唯一约束（仅对已填写工号的行生效）
export const internalMembersNoUnique = sql`CREATE UNIQUE INDEX IF NOT EXISTS internal_members_member_no_unique_idx ON internal_members (member_no) WHERE member_no IS NOT NULL`;

/**
 * 访客档案（潜在客户，与内部人员分开存储）
 */
export const visitors = pgTable(
  "visitors",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid("user_id").notNull().default(sql`auth.uid()`),
    name: varchar("name", { length: 128 }).notNull(),
    company: varchar("company", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    interest: varchar("interest", { length: 255 }),
    email: varchar("email", { length: 255 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("visitors_user_id_idx").on(table.user_id),
    index("visitors_company_idx").on(table.company),
  ]
);

/**
 * 合作意向（访客提交，内部人员跟进处理）
 */
export const inquiries = pgTable(
  "inquiries",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    visitor_id: varchar("visitor_id", { length: 36 }).notNull().references(() => visitors.id),
    user_id: uuid("user_id").notNull().default(sql`auth.uid()`),
    subject: varchar("subject", { length: 255 }).notNull(),
    message: text("message").notNull(),
    contact: varchar("contact", { length: 255 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("inquiries_visitor_id_idx").on(table.visitor_id),
    index("inquiries_user_id_idx").on(table.user_id),
    index("inquiries_status_idx").on(table.status),
    index("inquiries_created_at_idx").on(table.created_at),
  ]
);
