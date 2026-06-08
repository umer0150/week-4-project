import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tldraw, useEditor } from "tldraw";
import "tldraw/tldraw.css";
import { io } from "socket.io-client";
import { registerSchema, loginSchema } from "./lib/schemas";
import type { RegisterForm, LoginForm } from "./lib/schemas";

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : "http://localhost:3001";
const API = import.meta.env.PROD ? "/api" : "http://localhost:3001/api";

const socket = io(SOCKET_URL);
const ROOM = "room-1";

interface Account {
  id: number;
  name: string;
  username: string;
  email: string;
}

interface Message {
  id: number;
  username: string;
  message: string;
  time: string;
  isSystem?: boolean;
}

interface DashboardStats {
  onlineUsers: number;
  userList: { username: string; email: string; joinedAt: string }[];
  totalMessages: number;
  totalConnections: number;
  peakUsers: number;
}

// ─── Reusable Input Field ─────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-white/50 uppercase tracking-widest mb-1.5">
        {label}
      </label>
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ─── Register Form ────────────────────────────────────────
function RegisterForm({
  onSuccess,
  onSwitch,
}: {
  onSuccess: (account: Account) => void;
  onSwitch: () => void;
}) {
  const [serverError, setServerError] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checkingUser, setCheckingUser] = useState(false);
  const [userAvailable, setUserAvailable] = useState<boolean | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const nameValue = watch("name");
  const usernameValue = watch("username");

  useEffect(() => {
    if (!nameValue || nameValue.length < 2) return;
    const timeout = setTimeout(async () => {
      const res = await fetch(`${API}/auth/suggest-username/${nameValue}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    }, 500);
    return () => clearTimeout(timeout);
  }, [nameValue]);

  useEffect(() => {
    if (!usernameValue || usernameValue.length < 3) {
      setUserAvailable(null);
      return;
    }
    setCheckingUser(true);
    const timeout = setTimeout(async () => {
      const clean = usernameValue.replace("@", "");
      const res = await fetch(`${API}/auth/check-username/${clean}`);
      const data = await res.json();
      setUserAvailable(data.available);
      setCheckingUser(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [usernameValue]);

  const onSubmit = async (data: RegisterForm) => {
    setServerError("");
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setServerError(json.error); return; }
      localStorage.setItem("account", JSON.stringify(json.account));
      onSuccess(json.account);
    } catch {
      setServerError("Cannot connect to server");
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Full Name" error={errors.name?.message}>
        <input
          {...register("name")}
          placeholder="John Doe"
          className="w-full bg-[#16162a] border border-white/10 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
        />
      </Field>

      <Field label="Username" error={errors.username?.message}>
        <div className="relative">
          <input
            {...register("username")}
            placeholder="@ali12"
            className={`w-full bg-[#16162a] border rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white text-sm outline-none transition-colors placeholder:text-white/20
              ${userAvailable === true ? "border-emerald-500" : userAvailable === false ? "border-red-500" : "border-white/10 focus:border-indigo-500"}`}
          />
          <div className="absolute right-3 top-3 text-xs">
            {checkingUser && <span className="text-white/30">checking...</span>}
            {!checkingUser && userAvailable === true && <span className="text-emerald-400">✓ available</span>}
            {!checkingUser && userAvailable === false && <span className="text-red-400">✗ taken</span>}
          </div>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2">
            <p className="text-[10px] text-white/30 mb-1">Suggestions:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue("username", s)}
                  className="text-xs bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>

      <Field label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          placeholder="john@example.com"
          className="w-full bg-[#16162a] border border-white/10 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          placeholder="••••••••"
          className="w-full bg-[#16162a] border border-white/10 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
        />
      </Field>

      {serverError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          {serverError}
        </div>
      )}

      <button
        onClick={handleSubmit(onSubmit)}
        disabled={isSubmitting || userAvailable === false}
        className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm touch-manipulation"
      >
        {isSubmitting ? "Creating account..." : "Create Account →"}
      </button>

      <p className="text-center text-white/30 text-xs">
        Already have an account?{" "}
        <button onClick={onSwitch} className="text-indigo-400 hover:underline">
          Login
        </button>
      </p>
    </div>
  );
}

// ─── Login Form ───────────────────────────────────────────
function LoginFormComponent({
  onSuccess,
  onSwitch,
}: {
  onSuccess: (account: Account) => void;
  onSwitch: () => void;
}) {
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const onSubmit = async (data: LoginForm) => {
    setServerError("");
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { setServerError(json.error); return; }
      localStorage.setItem("account", JSON.stringify(json.account));
      onSuccess(json.account);
    } catch {
      setServerError("Cannot connect to server");
    }
  };

  return (
    <div className="space-y-4">
      <Field label="Username or Email" error={errors.identifier?.message}>
        <input
          {...register("identifier")}
          placeholder="@ali12 or john@example.com"
          className="w-full bg-[#16162a] border border-white/10 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          type="password"
          placeholder="••••••••"
          className="w-full bg-[#16162a] border border-white/10 rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 text-white text-sm outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
        />
      </Field>

      {serverError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
          {serverError}
        </div>
      )}

      <button
        onClick={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        className="w-full bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors text-sm touch-manipulation"
      >
        {isSubmitting ? "Logging in..." : "Login →"}
      </button>

      <p className="text-center text-white/30 text-xs">
        No account yet?{" "}
        <button onClick={onSwitch} className="text-indigo-400 hover:underline">
          Register
        </button>
      </p>
    </div>
  );
}

// ─── Auth Screen ──────────────────────────────────────────
function AuthScreen({ onLogin }: { onLogin: (account: Account) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#1e1e2e] rounded-2xl p-5 sm:p-8 w-full max-w-md shadow-2xl border border-white/10 my-auto">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1] animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-bold text-white">CollabCanvas</h1>
          </div>
          <p className="text-white/40 text-xs sm:text-sm">
            Real-time collaborative whiteboard
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-[#16162a] rounded-lg p-1 mb-5 sm:mb-6">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all capitalize touch-manipulation
                ${mode === m ? "bg-indigo-500 text-white" : "text-white/40 hover:text-white/60"}`}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "login" ? (
          <LoginFormComponent onSuccess={onLogin} onSwitch={() => setMode("register")} />
        ) : (
          <RegisterForm onSuccess={onLogin} onSwitch={() => setMode("login")} />
        )}
      </div>
    </div>
  );
}

// ─── Canvas Sync ──────────────────────────────────────────
function SyncLayer({ account }: { account: Account }) {
  const editor   = useEditor();
  const isRemote = useRef(false);
  const hasInit  = useRef(false); // prevent multiple snapshot loads

  useEffect(() => {
    socket.emit("join-room", {
      roomId:    ROOM,
      username:  account.username,
      email:     account.email,
      accountId: account.id,
    });

    // Load saved canvas only ONCE
    socket.on("init", (snapshot) => {
      if (hasInit.current) return; // ignore if already loaded
      hasInit.current = true;
      
      // Small delay so tldraw is fully mounted before loading snapshot
      setTimeout(() => {
        try {
          editor.loadSnapshot(snapshot);
        } catch (e) {
          console.warn("Snapshot load failed:", e);
        }
      }, 100);
    });

    // Apply changes from other users
    socket.on("change", (changes) => {
      isRemote.current = true;
      try {
        editor.store.mergeRemoteChanges(() => {
          const added   = changes.added   as Record<string, any>;
          const updated = changes.updated as Record<string, [any, any]>;
          const removed = changes.removed as Record<string, any>;
          Object.values(added).forEach((r)          => editor.store.put([r]));
          Object.values(updated).forEach(([, next]) => editor.store.put([next]));
          Object.values(removed).forEach((r)        => editor.store.remove([r.id]));
        });
      } catch (e) {
        console.warn("Change apply failed:", e);
      } finally {
        isRemote.current = false;
      }
    });

    // Send our changes — throttled to avoid too many snapshot saves
    let snapshotTimeout: ReturnType<typeof setTimeout>;

    const unsub = editor.store.listen(
      (entry) => {
        if (isRemote.current) return;

        // Send changes immediately
        socket.emit("change", { roomId: ROOM, changes: entry.changes });

        // Debounce snapshot saves — only save after 1s of no changes
        clearTimeout(snapshotTimeout);
        snapshotTimeout = setTimeout(() => {
          try {
            socket.emit("snapshot", { roomId: ROOM, snapshot: editor.getSnapshot() });
          } catch (e) {
            console.warn("Snapshot save failed:", e);
          }
        }, 1000);
      },
      { source: "user", scope: "document" }
    );

    return () => {
      unsub();
      clearTimeout(snapshotTimeout);
      socket.off("init");
      socket.off("change");
    };
  }, [editor, account]);

  return null;
}

// ─── Dashboard ────────────────────────────────────────────
function Dashboard({ account }: { account: Account }) {
  const [stats, setStats] = useState<DashboardStats>({
    onlineUsers: 0,
    userList: [],
    totalMessages: 0,
    totalConnections: 0,
    peakUsers: 0,
  });
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"stats" | "users">("stats");

  useEffect(() => {
    socket.on("dashboard-update", (data: DashboardStats) => setStats(data));
    return () => { socket.off("dashboard-update"); };
  }, []);

  const activityPct = Math.min(
    (stats.onlineUsers / Math.max(stats.peakUsers, 1)) * 100,
    100,
  );

  return (
    <div
      className={`fixed bottom-0 left-0 sm:left-30
        w-full sm:w-72
        bg-[#1e1e2e] rounded-t-xl shadow-2xl z-[99999] flex flex-col overflow-hidden transition-all duration-200
        ${open ? "h-80 sm:h-96" : "h-11"}`}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center px-4 h-11 bg-[#2a2a3e] cursor-pointer text-white font-semibold text-sm flex-shrink-0 touch-manipulation"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse" />
          <span>Live Dashboard</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-400/20 text-emerald-400 border border-emerald-400/30 px-2 py-0.5 rounded-full">
            {stats.onlineUsers} online
          </span>
          <span className="text-xs opacity-60">{open ? "▼" : "▲"}</span>
        </div>
      </div>

      {open && (
        <>
          <div className="flex bg-[#16162a] flex-shrink-0">
            {(["stats", "users"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all capitalize touch-manipulation
                  ${tab === t ? "text-indigo-400 border-indigo-400" : "text-white/40 border-transparent"}`}
              >
                {t === "users" ? `Users (${stats.onlineUsers})` : "Stats"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tab === "stats" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: stats.onlineUsers, label: "Online Now", color: "text-emerald-400" },
                    { value: stats.peakUsers, label: "Peak Users", color: "text-indigo-400" },
                    { value: stats.totalMessages, label: "Messages", color: "text-purple-400" },
                    { value: stats.totalConnections, label: "Total Joins", color: "text-orange-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-[#16162a] rounded-lg p-2.5 sm:p-3 text-center">
                      <div className={`text-xl sm:text-2xl font-extrabold ${s.color}`}>{s.value}</div>
                      <div className="text-[10px] text-white/35 uppercase tracking-widest mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-[11px] text-white/40 mb-1">Room Activity</div>
                  <div className="h-1.5 bg-[#16162a] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${activityPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-white/25 text-right mt-1">
                    {stats.onlineUsers} / {stats.peakUsers} peak
                  </div>
                </div>
                <div className="bg-[#16162a] rounded-lg px-3 py-2 space-y-0.5">
                  <div className="text-[10px] text-white/30 uppercase tracking-widest">Logged in as</div>
                  <div className="text-sm text-white font-semibold">{account.name}</div>
                  <div className="text-[11px] text-indigo-400">@{account.username}</div>
                </div>
              </>
            )}

            {tab === "users" && (
              <div className="space-y-2">
                {stats.userList.length === 0 ? (
                  <div className="text-center text-white/30 text-sm mt-10">No users online</div>
                ) : (
                  stats.userList.map((u, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#16162a] rounded-lg px-3 py-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {u.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-sm text-white font-semibold">
                          @{u.username}
                          {u.username === account.username && (
                            <span className="text-[9px] bg-indigo-400/20 text-indigo-400 border border-indigo-400/40 px-1.5 py-0.5 rounded">
                              you
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-white/30 truncate">{u.email}</div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399] flex-shrink-0" />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Chat ─────────────────────────────────────────────────
function Chat({ account }: { account: Account }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on("chat-history", (h: Message[]) => setMessages(h));
    socket.on("chat-message", (m: Message) => setMessages((p) => [...p, m]));
    socket.on("user-joined", (t: string) =>
      setMessages((p) => [...p, { id: Date.now(), username: "system", message: t, time: "", isSystem: true }])
    );
    socket.on("user-left", (t: string) =>
      setMessages((p) => [...p, { id: Date.now(), username: "system", message: t, time: "", isSystem: true }])
    );
    return () => {
      socket.off("chat-history");
      socket.off("chat-message");
      socket.off("user-joined");
      socket.off("user-left");
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    socket.emit("chat-message", { roomId: ROOM, message: input.trim(), username: account.username });
    setInput("");
  };

  return (
    <div
      className={`fixed bottom-20 right-0 sm:right-4
        w-full sm:w-72
        bg-[#1e1e2e] rounded-t-xl shadow-2xl z-[99999] flex flex-col overflow-hidden transition-all duration-200
        ${open ? "h-80 sm:h-96" : "h-11"}`}
    >
      {/* Header */}
      <div
        className="flex justify-between items-center px-4 h-11 bg-[#2a2a3e] cursor-pointer text-white font-semibold text-sm flex-shrink-0 touch-manipulation"
        onClick={() => setOpen(!open)}
      >
        <span>💬 Group Chat</span>
        <span className="text-xs opacity-60">{open ? "▼" : "▲"}</span>
      </div>

      {open && (
        <>
          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
            {messages.length === 0 && (
              <div className="text-center text-white/30 text-sm mt-10">
                No messages yet. Say hi! 👋
              </div>
            )}
            {messages.map((msg) =>
              msg.isSystem ? (
                <div key={msg.id} className="text-center text-white/30 text-xs italic">
                  {msg.message}
                </div>
              ) : (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 max-w-[85%]
                    ${msg.username === account.username ? "self-end items-end" : "self-start items-start"}`}
                >
                  {msg.username !== account.username && (
                    <span className="text-[10px] text-white/40 px-1">@{msg.username}</span>
                  )}
                  <div
                    className={`px-3 py-2 rounded-xl text-sm text-white leading-snug break-words
                      ${msg.username === account.username ? "bg-indigo-500 rounded-br-sm" : "bg-[#2e2e42] rounded-bl-sm"}`}
                  >
                    {msg.message}
                  </div>
                  <span className="text-[10px] text-white/25 px-1">{msg.time}</span>
                </div>
              )
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 p-2.5 bg-[#2a2a3e] flex-shrink-0">
            <input
              className="flex-1 bg-[#1e1e2e] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-indigo-500 transition-colors"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type a message..."
            />
            <button
              className="bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white text-sm font-semibold px-3 py-2 rounded-lg transition-colors touch-manipulation"
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────
export default function App() {
  const [account, setAccount] = useState<Account | null>(() => {
    const saved = localStorage.getItem("account");
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem("account");
    setAccount(null);
    socket.disconnect();
    socket.connect();
  };

  if (!account) return <AuthScreen onLogin={setAccount} />;

  return (
    <div className="fixed inset-0">
      {/* Logout button — top right, safe on all screens */}
      <button
        onClick={handleLogout}
        className="fixed top-2 right-2 sm:right-14 z-[99999] bg-[#2a2a3e] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition-all touch-manipulation"
      >
        Logout
      </button>

      <Tldraw licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}>
        <SyncLayer account={account} />
      </Tldraw>

      {/* On mobile: only one panel visible at a time via z-index stacking.
          Dashboard sits on left half, Chat on right half — both collapsed by default. */}
      <Dashboard account={account} />
      <Chat account={account} />
    </div>
  );
}

// export default function App() {
//   const [account, setAccount] = useState<Account | null>(() => {
//     const saved = localStorage.getItem("account");
//     return saved ? JSON.parse(saved) : null;
//   });

//   const handleLogout = () => {
//     localStorage.removeItem("account");
//     setAccount(null);
//     socket.disconnect();
//     socket.connect();
//   };

//   if (!account) return <AuthScreen onLogin={setAccount} />;

//   return (
//     // key={account.id} makes sure tldraw never remounts on re-render
//     <div key={account.id} className="fixed inset-0">
//       <button
//         onClick={handleLogout}
//         className="fixed top-2 right-80 z-[99999] bg-[#2a2a3e] hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 text-xs px-3 py-1.5 rounded-lg transition-all"
//       >
//         Logout
//       </button>
//       <Tldraw licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}>
//         <SyncLayer account={account} />
//       </Tldraw>
//       <Dashboard account={account} />
//       <Chat account={account} />
//     </div>
//   );
// }