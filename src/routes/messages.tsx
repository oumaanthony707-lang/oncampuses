import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Loader2, MessageCircle, Send, CheckCheck, Check } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";

const searchSchema = z.object({ c: z.string().uuid().optional() });

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Campus Marketplace" },
      { name: "description", content: "Chat with buyers and sellers in real time on Campus Marketplace." },
      { property: "og:title", content: "Messages — Campus Marketplace" },
      { property: "og:description", content: "Real-time chat between Kenyan students on Campus Marketplace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: MessagesPage,
});

type Conversation = {
  id: string;
  buyer_id: string;
  seller_id: string;
  listing_id: string | null;
  created_at: string;
  listing: { id: string; title: string; images: string[]; price: number } | null;
  buyer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  seller: { id: string; full_name: string | null; avatar_url: string | null } | null;
  last: { body: string; image_url: string | null; created_at: string; sender_id: string; read_at: string | null } | null;
  unread: number;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
};

function MessagesPage() {
  const navigate = useNavigate();
  const { c: activeId } = Route.useSearch();
  const [userId, setUserId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      setUserId(uid);
      setAuthReady(true);
      if (!uid) navigate({ to: "/auth", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user.id ?? null);
      if (!s) navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!authReady || !userId) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Inbox userId={userId} activeId={activeId} />;
}

function Inbox({ userId, activeId }: { userId: string; activeId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const conversationsQ = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async (): Promise<Conversation[]> => {
      const { data: convos, error } = await supabase
        .from("conversations")
        .select(`
          id, buyer_id, seller_id, listing_id, created_at,
          listing:listings(id,title,images,price),
          buyer:profiles!conversations_buyer_id_fkey(id,full_name,avatar_url),
          seller:profiles!conversations_seller_id_fkey(id,full_name,avatar_url)
        `)
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("created_at", { ascending: false });
      // profiles FK constraint name may not exist; fall back if that fails.
      let rows = convos as any[] | null;
      if (error) {
        const { data: fallback, error: e2 } = await supabase
          .from("conversations")
          .select(`id, buyer_id, seller_id, listing_id, created_at, listing:listings(id,title,images,price)`)
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .order("created_at", { ascending: false });
        if (e2) throw e2;
        rows = fallback as any[];
        const ids = Array.from(new Set(rows.flatMap((r) => [r.buyer_id, r.seller_id])));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,avatar_url")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        rows.forEach((r) => {
          r.buyer = map.get(r.buyer_id) ?? null;
          r.seller = map.get(r.seller_id) ?? null;
        });
      }
      const list = rows ?? [];
      if (list.length === 0) return [];
      const convoIds = list.map((c) => c.id);
      const { data: msgs } = await supabase
        .from("messages")
        .select("conversation_id,body,image_url,created_at,sender_id,read_at")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: false });
      const lastByConvo = new Map<string, any>();
      const unreadByConvo = new Map<string, number>();
      (msgs ?? []).forEach((m: any) => {
        if (!lastByConvo.has(m.conversation_id)) lastByConvo.set(m.conversation_id, m);
        if (m.sender_id !== userId && !m.read_at) {
          unreadByConvo.set(m.conversation_id, (unreadByConvo.get(m.conversation_id) ?? 0) + 1);
        }
      });
      return list.map((c) => ({
        ...c,
        last: lastByConvo.get(c.id) ?? null,
        unread: unreadByConvo.get(c.id) ?? 0,
      })) as Conversation[];
    },
  });

  // Live-update conversation list on any new/updated message.
  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const conversations = conversationsQ.data ?? [];
  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const setActive = (id: string | undefined) => {
    navigate({ to: "/messages", search: id ? { c: id } : {}, replace: false });
  };

  return (
    <div className="mx-auto max-w-7xl px-2 py-4 sm:px-4 sm:py-6">
      <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)] md:grid-cols-[340px_1fr]" style={{ height: "calc(100vh - 8rem)" }}>
        {/* List */}
        <aside className={`flex flex-col border-r border-border ${active ? "hidden md:flex" : "flex"}`}>
          <div className="border-b border-border px-4 py-3">
            <h1 className="text-lg font-bold">Messages</h1>
            <p className="text-xs text-muted-foreground">Chat with buyers and sellers</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsQ.isLoading ? (
              <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversations.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-muted-foreground">
                <MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-40" />
                No conversations yet. Message a seller from a listing to start chatting.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => {
                  const other = c.buyer_id === userId ? c.seller : c.buyer;
                  const otherName = other?.full_name || "Student";
                  const isActive = c.id === activeId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setActive(c.id)}
                        className={"flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-secondary/60 " + (isActive ? "bg-secondary" : "")}
                      >
                        <Avatar name={otherName} src={other?.avatar_url ?? null} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-sm font-semibold">{otherName}</span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">{c.last ? timeAgo(c.last.created_at) : timeAgo(c.created_at)}</span>
                          </div>
                          {c.listing && (
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              {c.listing.images?.[0] && (
                                <img src={c.listing.images[0]} alt="" className="h-4 w-4 rounded object-cover" />
                              )}
                              <span className="truncate">{c.listing.title}</span>
                            </div>
                          )}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-muted-foreground">
                              {c.last?.image_url && !c.last?.body ? "📷 Photo" : c.last?.body || "Say hi 👋"}
                            </span>
                            {c.unread > 0 && (
                              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                                {c.unread > 9 ? "9+" : c.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={`flex min-h-0 flex-col ${active ? "flex" : "hidden md:flex"}`}>
          {active ? (
            <Thread key={active.id} userId={userId} conversation={active} onBack={() => setActive(undefined)} />
          ) : (
            <div className="grid flex-1 place-items-center px-6 text-center">
              <div>
                <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <p className="mt-3 text-sm text-muted-foreground">Select a conversation to start chatting.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Avatar({ name, src, size = 40 }: { name: string; src: string | null; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-bold text-muted-foreground"
      style={{ height: size, width: size }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function Thread({ userId, conversation, onBack }: { userId: string; conversation: Conversation; onBack: () => void }) {
  const qc = useQueryClient();
  const other = conversation.buyer_id === userId ? conversation.seller : conversation.buyer;
  const otherId = conversation.buyer_id === userId ? conversation.seller_id : conversation.buyer_id;
  const otherName = other?.full_name || "Student";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherOnline, setOtherOnline] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load messages
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,image_url,read_at,created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error("Couldn't load messages");
        } else {
          setMessages((data ?? []) as Message[]);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [conversation.id]);

  // Realtime subscription: db changes + typing broadcast + presence
  useEffect(() => {
    const ch = supabase.channel(`conv:${conversation.id}`, {
      config: { presence: { key: userId } },
    });
    ch.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
      (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      },
    );
    ch.on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
      (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
      },
    );
    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      if (payload?.userId && payload.userId !== userId) {
        setOtherTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setOtherTyping(false), 2500);
      }
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      setOtherOnline(Boolean(state[otherId]?.length));
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ online_at: new Date().toISOString() });
      }
    });
    channelRef.current = ch;
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [conversation.id, userId, otherId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, otherTyping]);

  // Mark inbound messages as read
  useEffect(() => {
    const unreadIds = messages.filter((m) => m.sender_id !== userId && !m.read_at).map((m) => m.id);
    if (unreadIds.length === 0) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds)
      .then(({ error }) => {
        if (!error) {
          qc.invalidateQueries({ queryKey: ["conversations", userId] });
        }
      });
  }, [messages, userId, qc]);

  const emitTyping = () => {
    channelRef.current?.send({ type: "broadcast", event: "typing", payload: { userId } });
  };

  const sendMessage = async (opts?: { imageUrl?: string; body?: string }) => {
    const body = (opts?.body ?? text).trim();
    const imageUrl = opts?.imageUrl ?? null;
    if (!body && !imageUrl) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        sender_id: userId,
        body: body || "",
        image_url: imageUrl,
      })
      .select("id,conversation_id,sender_id,body,image_url,read_at,created_at")
      .single();
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      setMessages((prev) => (prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]));
    }
    if (!opts) setText("");
    qc.invalidateQueries({ queryKey: ["conversations", userId] });
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only images are supported");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    const path = `${userId}/${conversation.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("chat-images").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { data: signed, error: signErr } = await supabase.storage
      .from("chat-images")
      .createSignedUrl(path, TEN_YEARS);
    setUploading(false);
    if (signErr || !signed) {
      toast.error("Couldn't attach image");
      return;
    }
    await sendMessage({ imageUrl: signed.signedUrl });
  };

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button onClick={onBack} className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary md:hidden" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="relative">
          <Avatar name={otherName} src={other?.avatar_url ?? null} />
          <span className={"absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card " + (otherOnline ? "bg-success" : "bg-muted-foreground/40")} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{otherName}</div>
          <div className="text-[11px] text-muted-foreground">
            {otherTyping ? <span className="text-primary">typing…</span> : otherOnline ? "Online" : "Offline"}
          </div>
        </div>
        {conversation.listing && (
          <Link
            to="/listing/$id"
            params={{ id: conversation.listing.id }}
            className="hidden items-center gap-2 rounded-xl border border-border px-2 py-1.5 text-xs hover:bg-secondary sm:flex"
          >
            {conversation.listing.images?.[0] && (
              <img src={conversation.listing.images[0]} alt="" className="h-8 w-8 rounded-lg object-cover" />
            )}
            <div className="min-w-0">
              <div className="max-w-[160px] truncate font-semibold">{conversation.listing.title}</div>
              <div className="text-primary">KES {conversation.listing.price.toLocaleString()}</div>
            </div>
          </Link>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-secondary/30 px-4 py-4">
        {loading ? (
          <div className="grid place-items-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : messages.length === 0 ? (
          <div className="grid place-items-center py-16 text-center text-sm text-muted-foreground">
            Send the first message to start the conversation.
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === userId;
            const showTime = i === 0 || (new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 5 * 60_000);
            return (
              <div key={m.id}>
                {showTime && (
                  <div className="my-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                    {new Date(m.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                )}
                <div className={"flex " + (mine ? "justify-end" : "justify-start")}>
                  <div
                    className={
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm " +
                      (mine
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-card text-foreground border border-border")
                    }
                  >
                    {m.image_url && (
                      <img src={m.image_url} alt="attachment" className="mb-1 max-h-64 rounded-lg object-cover" />
                    )}
                    {m.body && <div className="whitespace-pre-wrap break-words">{m.body}</div>}
                    <div className={"mt-1 flex items-center justify-end gap-1 text-[10px] " + (mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {mine && (m.read_at ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {otherTyping && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/70" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void sendMessage(); }}
        className="flex items-end gap-2 border-t border-border bg-background px-3 py-3"
      >
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          aria-label="Attach image"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </button>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); emitTyping(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          rows={1}
          placeholder="Type a message…"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-secondary/60 px-4 py-2 text-sm outline-none focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/15"
        />
        <Button
          type="submit"
          disabled={sending || (!text.trim())}
          className="h-10 shrink-0 rounded-full bg-[image:var(--gradient-primary)] px-4 text-primary-foreground shadow-[var(--shadow-elegant)]"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </>
  );
}