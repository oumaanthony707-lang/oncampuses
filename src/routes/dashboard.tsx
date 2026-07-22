import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  User as UserIcon,
  Package,
  Heart,
  Receipt,
  Bell,
  Settings as SettingsIcon,
  Loader2,
  Upload,
  LogOut,
  Trash2,
  Check,
  ExternalLink,
  Pencil,
  X,
  BadgeCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ListingCard } from "@/components/listing-card";
import { formatKES, timeAgo } from "@/lib/format";

type TabKey = "profile" | "listings" | "saved" | "history" | "notifications" | "settings";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "Profile", icon: UserIcon },
  { key: "listings", label: "My listings", icon: Package },
  { key: "saved", label: "Saved", icon: Heart },
  { key: "history", label: "Orders & sales", icon: Receipt },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

type SearchParams = { tab?: TabKey };

const VALID_TABS: TabKey[] = ["profile", "listings", "saved", "history", "notifications", "settings"];

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    const tab = search.tab as string | undefined;
    return VALID_TABS.includes(tab as TabKey) ? { tab: tab as TabKey } : {};
  },
  head: () => ({
    meta: [
      { title: "Your dashboard — Campus Marketplace" },
      { name: "description", content: "Manage your listings, saved items, orders, notifications and profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function DashboardPage() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const activeTab: TabKey = tab ?? "profile";

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      setUserEmail(data.session.user.email ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/auth" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const setTab = (t: TabKey) => navigate({ to: "/dashboard", search: { tab: t } });

  if (checking || !userId) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-accent">Your account</div>
        <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Dashboard</h1>
      </div>

      {/* Mobile tab bar */}
      <div className="mb-6 -mx-4 overflow-x-auto px-4 md:hidden">
        <div className="flex gap-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === activeTab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden md:block">
          <nav className="sticky top-20 space-y-1 rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-card)]">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.key === activeTab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          {activeTab === "profile" && <ProfileTab userId={userId} />}
          {activeTab === "listings" && <ListingsTab userId={userId} />}
          {activeTab === "saved" && <SavedTab userId={userId} />}
          {activeTab === "history" && <HistoryTab userId={userId} />}
          {activeTab === "notifications" && <NotificationsTab userId={userId} />}
          {activeTab === "settings" && <SettingsTab userEmail={userEmail} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- PROFILE ------------------------- */

function ProfileTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const profileQ = useQuery({
    queryKey: ["dash-profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const universitiesQ = useQuery({
    queryKey: ["dash-universities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("universities").select("id,name,short_name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState<string>("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = profileQ.data;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setBio(p.bio ?? "");
    setUniversityId(p.university_id ?? "");
    setCourse(p.course ?? "");
    setYear(p.year_of_study ? String(p.year_of_study) : "");
    setPhone(p.phone ?? "");
    setWhatsapp(p.whatsapp ?? "");
    setAvatarUrl(p.avatar_url ?? null);
  }, [profileQ.data]);

  const handleAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("avatars").createSignedUrl(path, TEN_YEARS);
      if (sErr || !signed?.signedUrl) throw sErr ?? new Error("Failed to sign avatar URL");
      const url = signed.signedUrl;
      const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
      if (updErr) throw updErr;
      setAvatarUrl(url);
      qc.invalidateQueries({ queryKey: ["dash-profile", userId] });
      toast.success("Profile photo updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          bio: bio.trim() || null,
          university_id: universityId || null,
          course: course.trim() || null,
          year_of_study: year ? Number(year) : null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
        })
        .eq("id", userId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["dash-profile", userId] });
      toast.success("Profile saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  if (profileQ.isLoading) return <SkeletonCard />;

  return (
    <form onSubmit={save} className="space-y-6">
      <SectionCard title="Profile photo">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-secondary">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xl font-bold text-muted-foreground">
                {(fullName || "U").slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleAvatar(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button type="button" variant="outline" className="rounded-full" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? "Uploading…" : "Change photo"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WEBP · up to 5 MB.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="About you">
        <div className="space-y-4">
          <Labeled label="Full name">
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} className={inputCls} placeholder="Your name" />
          </Labeled>
          <Labeled label="Bio">
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className={`${inputCls} min-h-[90px] py-3`} placeholder="A few words about you and what you sell" />
          </Labeled>
        </div>
      </SectionCard>

      <SectionCard title="Studies">
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="University">
            <select value={universityId} onChange={(e) => setUniversityId(e.target.value)} className={selectCls}>
              <option value="">Select your university</option>
              {(universitiesQ.data ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.short_name ? `${u.short_name} — ${u.name}` : u.name}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Course">
            <input value={course} onChange={(e) => setCourse(e.target.value)} className={inputCls} placeholder="e.g. BSc Computer Science" />
          </Labeled>
          <Labeled label="Year of study">
            <select value={year} onChange={(e) => setYear(e.target.value)} className={selectCls}>
              <option value="">Select year</option>
              {[1, 2, 3, 4, 5, 6].map((y) => (
                <option key={y} value={y}>Year {y}</option>
              ))}
            </select>
          </Labeled>
        </div>
      </SectionCard>

      <SectionCard title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Phone">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="+254 7XX XXX XXX" />
          </Labeled>
          <Labeled label="WhatsApp">
            <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} placeholder="+254 7XX XXX XXX" />
          </Labeled>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={saving} className="rounded-full bg-[image:var(--gradient-primary)] px-8 text-primary-foreground shadow-[var(--shadow-elegant)]">
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------- MY LISTINGS ------------------------- */

function ListingsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const listingsQ = useQuery({
    queryKey: ["dash-listings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title,price,images,location,created_at,condition,is_featured,status")
        .eq("seller_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const markSold = async (id: string) => {
    const { error } = await supabase.from("listings").update({ status: "sold" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Marked as sold");
    qc.invalidateQueries({ queryKey: ["dash-listings", userId] });
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Listing deleted");
    qc.invalidateQueries({ queryKey: ["dash-listings", userId] });
  };

  if (listingsQ.isLoading) return <SkeletonCard />;
  const items = listingsQ.data ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No listings yet"
        body="Post your first item and start reaching buyers on your campus."
        action={<Link to="/sell"><Button className="rounded-full bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-glow)]">Post a listing</Button></Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{items.length} listing{items.length === 1 ? "" : "s"}</div>
        <Link to="/sell"><Button size="sm" className="rounded-full bg-[image:var(--gradient-accent)] text-accent-foreground">+ New listing</Button></Link>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <div key={it.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
            <Link to="/listing/$id" params={{ id: it.id }} className="relative block aspect-square overflow-hidden bg-secondary">
              {it.images?.[0] ? (
                <img src={it.images[0]} alt={it.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
              )}
              <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusBadge(it.status)}`}>
                {it.status}
              </span>
            </Link>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <div className="text-base font-bold text-primary">{formatKES(it.price)}</div>
              <div className="line-clamp-2 text-sm font-medium">{it.title}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(it.created_at)}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {it.status !== "sold" && (
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => markSold(it.id)}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Sold
                  </Button>
                )}
                <Link to="/listing/$id" params={{ id: it.id }}>
                  <Button size="sm" variant="outline" className="rounded-full">
                    <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
                  </Button>
                </Link>
                <Button size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive" onClick={() => remove(it.id)}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function statusBadge(status: string) {
  switch (status) {
    case "active": return "bg-primary text-primary-foreground";
    case "sold": return "bg-accent text-accent-foreground";
    case "pending": return "bg-secondary text-foreground";
    case "draft": return "bg-muted text-muted-foreground";
    default: return "bg-secondary text-muted-foreground";
  }
}

/* ------------------------- SAVED ------------------------- */

function SavedTab({ userId }: { userId: string }) {
  const savedQ = useQuery({
    queryKey: ["dash-saved", userId],
    queryFn: async () => {
      const { data: favs, error } = await supabase
        .from("favorites")
        .select("listing_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (favs ?? []).map((f) => f.listing_id);
      if (ids.length === 0) return [];
      const { data: listings, error: e2 } = await supabase
        .from("listings")
        .select("id,title,price,images,location,created_at,condition,is_featured")
        .in("id", ids);
      if (e2) throw e2;
      const order = new Map(ids.map((id, i) => [id, i]));
      return (listings ?? []).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
  });

  if (savedQ.isLoading) return <SkeletonCard />;
  const items = savedQ.data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="Nothing saved yet"
        body="Tap the heart on any listing to save it here for later."
        action={<Link to="/marketplace"><Button className="rounded-full">Browse marketplace</Button></Link>}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((it) => (
        <ListingCard key={it.id} item={it} />
      ))}
    </div>
  );
}

/* ------------------------- HISTORY ------------------------- */

function HistoryTab({ userId }: { userId: string }) {
  const purchasesQ = useQuery({
    queryKey: ["dash-purchases", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,amount,status,created_at,listing_id")
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((o) => o.listing_id).filter(Boolean) as string[];
      const titleMap = new Map<string, string>();
      if (ids.length) {
        const { data: ls } = await supabase.from("listings").select("id,title").in("id", ids);
        (ls ?? []).forEach((l) => titleMap.set(l.id, l.title));
      }
      return (data ?? []).map((o) => ({ ...o, title: (o.listing_id && titleMap.get(o.listing_id)) || "Listing" }));
    },
  });

  const salesQ = useQuery({
    queryKey: ["dash-sales", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title,price,updated_at")
        .eq("seller_id", userId)
        .eq("status", "sold")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <SectionCard title="Purchases">
        {purchasesQ.isLoading ? (
          <SkeletonRows />
        ) : (purchasesQ.data ?? []).length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No purchases yet.</div>
        ) : (
          <HistoryTable
            rows={(purchasesQ.data ?? []).map((o) => ({
              id: o.id,
              title: o.title,
              amount: o.amount,
              status: o.status,
              date: o.created_at,
              listingId: o.listing_id,
            }))}
          />
        )}
      </SectionCard>

      <SectionCard title="Sales">
        {salesQ.isLoading ? (
          <SkeletonRows />
        ) : (salesQ.data ?? []).length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No sales yet.</div>
        ) : (
          <HistoryTable
            rows={(salesQ.data ?? []).map((l) => ({
              id: l.id,
              title: l.title,
              amount: l.price,
              status: "sold",
              date: l.updated_at,
              listingId: l.id,
            }))}
          />
        )}
      </SectionCard>
    </div>
  );
}

function HistoryTable({ rows }: { rows: { id: string; title: string; amount: number | string; status: string; date: string; listingId: string | null }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="pb-2 font-semibold">Item</th>
            <th className="pb-2 font-semibold">Amount</th>
            <th className="pb-2 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Date</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="py-3 pr-3 font-medium">{r.title}</td>
              <td className="py-3 pr-3">{formatKES(r.amount)}</td>
              <td className="py-3 pr-3">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">{r.status}</span>
              </td>
              <td className="py-3 pr-3 text-muted-foreground">{timeAgo(r.date)}</td>
              <td className="py-3 text-right">
                {r.listingId && (
                  <Link to="/listing/$id" params={{ id: r.listingId }} className="text-primary hover:underline">
                    View
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------- NOTIFICATIONS ------------------------- */

function NotificationsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const notifsQ = useQuery({
    queryKey: ["dash-notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,type,title,body,link,is_read,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const unread = useMemo(() => (notifsQ.data ?? []).filter((n) => !n.is_read), [notifsQ.data]);

  const markAllRead = async () => {
    if (unread.length === 0) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["dash-notifications", userId] });
    qc.invalidateQueries({ queryKey: ["unread-notifications", userId] });
  };

  const dismiss = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["dash-notifications", userId] });
    qc.invalidateQueries({ queryKey: ["unread-notifications", userId] });
  };

  if (notifsQ.isLoading) return <SkeletonCard />;
  const items = notifsQ.data ?? [];
  if (items.length === 0) {
    return <EmptyState icon={Bell} title="You're all caught up" body="Messages, offers and status updates will appear here." />;
  }

  return (
    <SectionCard
      title="Notifications"
      right={
        unread.length > 0 ? (
          <Button size="sm" variant="outline" className="rounded-full" onClick={markAllRead}>
            Mark all read
          </Button>
        ) : null
      }
    >
      <ul className="divide-y divide-border">
        {items.map((n) => (
          <li key={n.id} className={`flex items-start gap-3 py-3 ${n.is_read ? "" : "bg-primary/5"} -mx-2 rounded-xl px-2`}>
            <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-accent"}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</div>
            </div>
            <button className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" onClick={() => dismiss(n.id)} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/* ------------------------- SETTINGS ------------------------- */

function SettingsTab({ userEmail }: { userEmail: string | null }) {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Password updated");
      setPw(""); setPw2("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update password");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Account">
        <div className="flex items-center gap-2 text-sm">
          <BadgeCheck className="h-4 w-4 text-primary" />
          <span className="text-muted-foreground">Signed in as</span>
          <span className="font-semibold">{userEmail ?? "—"}</span>
        </div>
      </SectionCard>

      <SectionCard title="Change password">
        <form onSubmit={changePw} className="space-y-3">
          <Labeled label="New password">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6} className={inputCls} placeholder="At least 6 characters" />
          </Labeled>
          <Labeled label="Confirm password">
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} minLength={6} className={inputCls} placeholder="Repeat new password" />
          </Labeled>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="rounded-full">
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…</> : <><Pencil className="mr-2 h-4 w-4" /> Update password</>}
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard title="Session">
        <Button type="button" variant="outline" className="rounded-full" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </SectionCard>

      <SectionCard title="Delete account">
        <div className="flex items-start gap-3 rounded-xl bg-destructive/5 p-4 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            Permanent account deletion is handled by our support team to protect against fraud. Sign out from your device and email support to request full deletion.
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

/* ------------------------- SHARED UI ------------------------- */

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";
const selectCls =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card p-12 text-center shadow-[var(--shadow-card)]">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-64 animate-pulse rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]" />;
}
function SkeletonRows() {
  return (
    <div className="space-y-2">
      <div className="h-10 animate-pulse rounded-lg bg-secondary" />
      <div className="h-10 animate-pulse rounded-lg bg-secondary" />
      <div className="h-10 animate-pulse rounded-lg bg-secondary" />
    </div>
  );
}