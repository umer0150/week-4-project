import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { eq, count, ilike } from "drizzle-orm";
import db from "./db/index";
import { accounts, users, messages, canvasSnapshots } from "./db/schema";

dotenv.config();

// ─── Path Setup ───────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── App Setup ────────────────────────────────────────────
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// ─── Health Check (must be FIRST before everything) ───────
app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});

// ─── In-Memory Online Users ───────────────────────────────
const onlineUsers: Record<
  string,
  {
    accountId: string;
    username: string;
    email: string;
    roomId: string;
    joinedAt: string;
  }
> = {};

const stats = { totalConnections: 0, peakUsers: 0 };

// ─── Dashboard Helper ─────────────────────────────────────
async function sendDashboardUpdate(roomId: string) {
  const usersInRoom = Object.values(onlineUsers).filter(
    (u) => u.roomId === roomId,
  );
  const msgResult = await db
    .select({ count: count() })
    .from(messages)
    .where(eq(messages.roomId, roomId));

  io.to(roomId).emit("dashboard-update", {
    onlineUsers: usersInRoom.length,
    userList: usersInRoom,
    totalMessages: Number(msgResult[0]?.count ?? 0),
    totalConnections: stats.totalConnections,
    peakUsers: stats.peakUsers,
  });
}

// ─── Auth Routes ──────────────────────────────────────────
app.get("/api/auth/check-username/:username", async (req, res) => {
  const username = req.params.username.toLowerCase();
  const existing = await db
    .select()
    .from(accounts)
    .where(ilike(accounts.username, username));
  res.json({ available: existing.length === 0 });
});

app.get("/api/auth/suggest-username/:name", async (req, res) => {
  const base = req.params.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const suggestions: string[] = [];

  while (suggestions.length < 4) {
    const num = Math.floor(10 + Math.random() * 90);
    const candidate = `@${base}${num}`;
    const existing = await db
      .select()
      .from(accounts)
      .where(ilike(accounts.username, candidate.replace("@", "")));
    if (existing.length === 0) suggestions.push(candidate);
  }

  res.json({ suggestions });
});

app.post("/api/auth/register", async (req, res) => {
  const { name, username, email, password } = req.body as {
    name: string;
    username: string;
    email: string;
    password: string;
  };

  const emailExists = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, email.toLowerCase()));
  if (emailExists.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const usernameExists = await db
    .select()
    .from(accounts)
    .where(ilike(accounts.username, username.replace("@", "")));
  if (usernameExists.length > 0) {
    res.status(400).json({ error: "Username already taken" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newAccount = await db
    .insert(accounts)
    .values({
      name,
      username: username.replace("@", "").toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
    })
    .returning();

  const account = newAccount[0]!;
  res.json({
    message: "Account created successfully",
    account: {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
    },
  });
});

app.post("/api/auth/login", async (req, res) => {
  const { identifier, password } = req.body as {
    identifier: string;
    password: string;
  };

  const isEmail = identifier.includes("@") && identifier.includes(".");
  const found = isEmail
    ? await db
        .select()
        .from(accounts)
        .where(eq(accounts.email, identifier.toLowerCase()))
    : await db
        .select()
        .from(accounts)
        .where(ilike(accounts.username, identifier.replace("@", "")));

  if (found.length === 0) {
    res.status(401).json({ error: "Invaild Credentials" });
    return;
  }

  const account = found[0]!;
  const isValid = await bcrypt.compare(password, account.password);
  if (!isValid) {
    res.status(401).json({ error: "Invaild Credentials" });
    return;
  }

  res.json({
    message: "Login successful",
    account: {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
    },
  });
});

// ─── REST API ─────────────────────────────────────────────
app.get("/api/messages/:roomId", async (req, res) => {
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.roomId, req.params.roomId))
    .orderBy(messages.sentAt);
  res.json(result);
});

app.get("/api/users/:roomId", async (req, res) => {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.roomId, req.params.roomId))
    .orderBy(users.joinedAt);
  res.json(result);
});

app.get("/api/stats/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const [msgCount, userCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.roomId, roomId)),
    db.select({ count: count() }).from(users).where(eq(users.roomId, roomId)),
  ]);
  res.json({
    totalMessages: Number(msgCount[0]?.count ?? 0),
    totalJoins: Number(userCount[0]?.count ?? 0),
  });
});

// ─── Socket Events ────────────────────────────────────────
io.on("connection", (socket) => {
  stats.totalConnections++;
  console.log(`[+] Connected: ${socket.id}`);

  socket.on(
    "join-room",
    async ({
      roomId,
      username,
      email,
      accountId,
    }: {
      roomId: string;
      username: string;
      email: string;
      accountId: string;
    }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = username;
      socket.data.accountId = accountId;

      onlineUsers[socket.id] = {
        accountId,
        username,
        email,
        roomId,
        joinedAt: new Date().toISOString(),
      };

      const total = Object.keys(onlineUsers).length;
      if (total > stats.peakUsers) stats.peakUsers = total;

      await db.insert(users).values({
        accountId: String(accountId),
        socketId: socket.id,
        username,
        roomId,
      });

      const savedCanvas = await db
        .select()
        .from(canvasSnapshots)
        .where(eq(canvasSnapshots.roomId, roomId));
      if (savedCanvas.length > 0) socket.emit("init", savedCanvas[0]?.snapshot);

      const chatHistory = await db
        .select()
        .from(messages)
        .where(eq(messages.roomId, roomId))
        .orderBy(messages.sentAt);
      if (chatHistory.length > 0) {
        socket.emit(
          "chat-history",
          chatHistory.map((msg) => ({
            ...msg,
            time: new Date(msg.sentAt!).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })),
        );
      }

      io.to(roomId).emit("user-joined", `@${username} joined the room`);
      sendDashboardUpdate(roomId);
      console.log(`[Room: ${roomId}] @${username} joined`);
    },
  );

  socket.on(
    "change",
    ({ roomId, changes }: { roomId: string; changes: unknown }) => {
      socket.to(roomId).emit("change", changes);
    },
  );

  socket.on(
    "snapshot",
    async ({ roomId, snapshot }: { roomId: string; snapshot: unknown }) => {
      await db
        .insert(canvasSnapshots)
        .values({ roomId, snapshot, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: canvasSnapshots.roomId,
          set: { snapshot, updatedAt: new Date() },
        });
    },
  );

  socket.on(
    "chat-message",
    async ({
      roomId,
      message,
      username,
    }: {
      roomId: string;
      message: string;
      username: string;
    }) => {
      const saved = await db
        .insert(messages)
        .values({ roomId, username, message })
        .returning();
      const newMsg = {
        id: saved[0]?.id,
        username,
        message,
        time: new Date(saved[0]?.sentAt!).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      io.to(roomId).emit("chat-message", newMsg);
      sendDashboardUpdate(roomId);
    },
  );

  socket.on("disconnect", async () => {
    const { roomId, username } = socket.data;
    await db
      .update(users)
      .set({ leftAt: new Date() })
      .where(eq(users.socketId, socket.id));
    delete onlineUsers[socket.id];
    if (roomId && username) {
      io.to(roomId).emit("user-left", `@${username} left the room`);
      sendDashboardUpdate(roomId);
    }
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

// ─── Serve React in Production ────────────────────────────
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  console.log("Serving static files from:", clientDist);

  app.use(express.static(clientDist));

  // Express 5 uses /* instead of *
  app.get("/*splat", (_, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ─── Start Server ─────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
