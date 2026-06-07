import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull(),
  username:  text("username").notNull().unique(),  // unique lowercase username like @umer12
  email:     text("email").notNull().unique(),
  password:  text("password").notNull(),           // hashed password
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id:        serial("id").primaryKey(),
  accountId: text("account_id").notNull(),
  socketId:  text("socket_id").notNull(),
  username:  text("username").notNull(),
  roomId:    text("room_id").notNull(),
  joinedAt:  timestamp("joined_at").defaultNow(),
  leftAt:    timestamp("left_at"),
});

export const messages = pgTable("messages", {
  id:       serial("id").primaryKey(),
  roomId:   text("room_id").notNull(),
  username: text("username").notNull(),
  message:  text("message").notNull(),
  sentAt:   timestamp("sent_at").defaultNow(),
});

export const canvasSnapshots = pgTable("canvas_snapshots", {
  roomId:    text("room_id").primaryKey(),
  snapshot:  jsonb("snapshot").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});