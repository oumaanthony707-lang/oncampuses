import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Package, Users, Flag, Image as ImageIcon, Wallet, Loader2, Check, X, Star,
  Trash2, BadgeCheck, Ban, Search, Plus, ExternalLink, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, timeAgo } from "@/lib/format";

type Section = "overview" | "listings" | "users" | "reports" | "banners" | "revenue";
const SECTIONS: { key: Section; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "listings", label: "Listings", icon: Package },
  { key: "users", label: "Users", icon: Users },
  { key: "reports", label: "Reports", icon: Flag },
  { key: "banners", label: "Banners", icon: ImageIcon },
  { key: "revenue", label: "Revenue", icon: Wallet },
];
const KEYS = SECTIONS.map((s) => s.key);

export const Route = createFileRoute("/admin")({
  validateSearch: (s: Record<string, unknown>): { section?: Section } =>
    KEYS.includes(s.section as Section) ? { section: s.section as Section } : {},
  head: () => ({
    meta: [
      { title: "Admin — Campus Marketplace" },
      { name: "description", content: "Moderate listings, users, reports and site content." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const { section = "overview" } = Route.useSearch();
  const [state, setState] = useState<{ ok: boolean; admin: boolean } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate({ to: "/auth" });
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role);
      const admin = roles.includes("admin");
      if (!admin && !roles.includes("moderator")) {
        toast.error("You don't have access to the admin area");
        return navigate({ to: "/" });
      }
      setState({ ok: true, admin });
    })();
  }, [navigate]);

  if (!state) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  const visible = SECTIONS.filter((s) => state.admin || (s.key !== "banners" && s.key !== "revenue"));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground"><ShieldCheck className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-bold">Admin dashboard</h1>
          <p className="text-sm text-muted-foreground">{state.admin ? "Administrator" : "Moderator"}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          {visible.map(({ key, label, icon: Icon }) => (
            <Link key={key} to="/admin" search={{ section: key }}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${section === key ? "bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]" : "hover:bg-secondary"}`}>
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0">
          {section === "overview" && <Overview admin={state.admin} />}
          {section === "listings" && <ListingsMod />}
          {section === "users" && <UsersMod />}
          {section === "reports" && <ReportsMod />}
          {section === "banners" && state.admin && <BannersMod />}
          {section === "revenue" && state.admin && <Revenue />}
        </main>
      </div>
    </div>
  );
}

const card = "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card,var(--shadow-elegant))]";

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className={card}>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value ?? "—"}</div>
    </div>
  );
}

async function count(table: "profiles" | "listings" | "reports", f?: (q: any) => any) {
  let q: any = supabase.from(table).select("id", { count: "exact", head: true });
  if (f) q = f(q);
  const { count: c } = await q;
  return c ?? 0;
}

function Overview({ admin }: { admin: boolean }) {
  const qc = useQueryClient();
  const since = useMemo(() => new Date(Date.now() - 7 * 864e5).toISOString(), []);
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, active, pending, sold, reports, signups] = await Promise.all([
        count("profiles"),
        count("listings", (q) => q.eq("status", "active")),
        count("listings", (q) => q.eq("status", "pending")),
        count("listings", (q) => q.eq("status", "sold")),
        count("reports", (q) => q.eq("status", "open")),
        count("profiles", (q) => q.gte("created_at", since)),
      ]);
      return { users, active, pending, sold, reports, signups };
    },
  });
  const series = useQuery({
    queryKey: ["admin-series"],
    queryFn: async () => {
      const from = new Date(Date.now() - 13 * 864e5);
      from.setHours(0, 0, 0, 0);
      const [p, l] = await Promise.all([
        supabase.from("profiles").select("created_at").gte("created_at", from.toISOString()),
        supabase.from("listings").select("created_at").gte("created_at", from.toISOString()),
      ]);
      const days = Array.from({ length: 14 }, (_, i) => new Date(from.getTime() + i * 864e5).toISOString().slice(0, 10));
      const bucket = (rows: { created_at: string }[] | null) => days.map((d) => (rows ?? []).filter((r) => r.created_at.slice(0, 10) === d).length);
      return { days, signups: bucket(p.data), listings: bucket(l.data) };
    },
  });
  const settings = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("require_approval").maybeSingle()).data,
  });

  const toggleApproval = async (v: boolean) => {
    const { error } = await supabase.from("platform_settings").update({ require_approval: v }).eq("id", true);
    if (error) return toast.error(error.message);
    toast.success(v ? "New listings now need approval" : "New listings go live immediately");
    qc.invalidateQueries({ queryKey: ["platform-settings"] });
  };

  const s = stats.data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <Stat label="Total users" value={s?.users} />
        <Stat label="Active listings" value={s?.active} />
        <Stat label="Pending listings" value={s?.pending} />
        <Stat label="Sold listings" value={s?.sold} />
        <Stat label="Open reports" value={s?.reports} />
        <Stat label="New signups (7d)" value={s?.signups} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <MiniChart title="Signups — last 14 days" days={series.data?.days} values={series.data?.signups} tone="bg-primary" />
        <MiniChart title="New listings — last 14 days" days={series.data?.days} values={series.data?.listings} tone="bg-accent" />
      </div>
      {admin && (
        <div className={`${card} flex items-center justify-between gap-4`}>
          <div>
            <div className="font-semibold">Require approval for new listings</div>
            <p className="text-sm text-muted-foreground">When on, new listings start as pending until a moderator approves them.</p>
          </div>
          <Switch checked={!!settings.data?.require_approval} onCheckedChange={toggleApproval} aria-label="Require approval" />
        </div>
      )}
    </div>
  );
}

function MiniChart({ title, days, values, tone }: { title: string; days?: string[]; values?: number[]; tone: string }) {
  const max = Math.max(1, ...(values ?? [0]));
  return (
    <div className={card}>
      <div className="mb-4 text-sm font-semibold">{title}</div>
      <div className="flex h-40 items-end gap-1" role="img" aria-label={title}>
        {(values ?? Array(14).fill(0)).map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${days?.[i] ?? ""}: ${v}`}>
            <div className={`w-full rounded-t-md ${tone} transition-all`} style={{ height: `${(v / max) * 100}%`, minHeight: v ? 4 : 2, opacity: v ? 1 : 0.2 }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{days?.[0]?.slice(5)}</span><span>{days?.[days.length - 1]?.slice(5)}</span>
      </div>
    </div>
  );
}

const STATUS_FILTERS = ["pending", "active", "rejected", "sold", "all"] as const;

function ListingsMod() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("pending");
  const q = useQuery({
    queryKey: ["admin-listings", status],
    queryFn: async () => {
      let query = supabase.from("listings").select("id,title,price,status,is_featured,images,created_at,rejection_reason,seller_id").order("created_at", { ascending: false }).limit(100);
      if (status !== "all") query = query.eq("status", status as never);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] }); };
  const update = async (id: string, patch: Record<string, unknown>, msg: string) => {
    const { error } = await supabase.from("listings").update(patch as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg); refresh();
  };
  const reject = (id: string) => {
    const reason = window.prompt("Reason for rejection?");
    if (reason === null) return;
    update(id, { status: "rejected", rejection_reason: reason.trim() || "Does not meet guidelines" }, "Listing rejected");
  };
  const remove = async (id: string) => {
    if (!window.confirm("Delete this listing permanently?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Listing deleted"); refresh();
  };

  return (
    <div className={card}>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${status === s ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}>{s}</button>
        ))}
      </div>
      {q.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : !q.data?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No listings here.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="p-2">Listing</th><th className="p-2">Price</th><th className="p-2">Status</th><th className="p-2">Posted</th><th className="p-2 text-right">Actions</th></tr></thead>
            <tbody>
              {q.data.map((l) => (
                <tr key={l.id} className="border-t border-border">
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <img src={l.images?.[0]} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-muted object-cover" />
                      <div className="min-w-0">
                        <Link to="/listing/$id" params={{ id: l.id }} className="line-clamp-1 font-medium hover:text-primary">{l.title}</Link>
                        {l.rejection_reason && <div className="line-clamp-1 text-xs text-destructive">{l.rejection_reason}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">{formatKES(Number(l.price))}</td>
                  <td className="p-2"><span className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{l.status}</span>{l.is_featured && <Star className="ml-1 inline h-3 w-3 fill-accent text-accent" />}</td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">{timeAgo(l.created_at)}</td>
                  <td className="p-2">
                    <div className="flex justify-end gap-1">
                      {l.status !== "active" && <Button size="sm" variant="outline" onClick={() => update(l.id, { status: "active", rejection_reason: null }, "Listing approved")} aria-label="Approve"><Check className="h-4 w-4" /></Button>}
                      {l.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => reject(l.id)} aria-label="Reject"><X className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="outline" onClick={() => update(l.id, { is_featured: !l.is_featured }, l.is_featured ? "Unfeatured" : "Featured")} aria-label={l.is_featured ? "Unfeature" : "Feature"}><Star className={`h-4 w-4 ${l.is_featured ? "fill-accent text-accent" : ""}`} /></Button>
                      <Button size="sm" variant="outline" onClick={() => remove(l.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersMod() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const q = useQuery({
    queryKey: ["admin-users", term],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id,full_name,username,avatar_url,phone,is_verified,is_suspended,created_at,course").order("created_at", { ascending: false }).limit(100);
      const t = term.trim().replace(/[,()]/g, "");
      if (t) query = query.or(`full_name.ilike.%${t}%,username.ilike.%${t}%,phone.ilike.%${t}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
  const update = async (id: string, patch: { is_verified?: boolean; is_suspended?: boolean }, msg: string) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg); qc.invalidateQueries({ queryKey: ["admin-users"] });
  };
  return (
    <div className={card}>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name, username or phone" className="pl-9" aria-label="Search users" />
      </div>
      {q.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : !q.data?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No users found.</p>
      ) : (
        <ul className="divide-y divide-border">
          {q.data.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary font-semibold">
                {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.full_name?.[0] ?? "?")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 font-medium">{u.full_name ?? "Unnamed"} {u.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}{u.is_suspended && <span className="ml-1 rounded-full bg-destructive/10 px-2 text-xs text-destructive">Suspended</span>}</div>
                <div className="text-xs text-muted-foreground">{u.course ?? "—"} · joined {timeAgo(u.created_at)}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => update(u.id, { is_verified: !u.is_verified }, u.is_verified ? "Verification removed" : "Seller verified")}>
                  <BadgeCheck className="mr-1 h-4 w-4" />{u.is_verified ? "Unverify" : "Verify"}
                </Button>
                <Button size="sm" variant={u.is_suspended ? "default" : "outline"} onClick={() => update(u.id, { is_suspended: !u.is_suspended }, u.is_suspended ? "User unsuspended" : "User suspended")}>
                  <Ban className="mr-1 h-4 w-4" />{u.is_suspended ? "Unsuspend" : "Suspend"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportsMod() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const q = useQuery({
    queryKey: ["admin-reports", status],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("id,reason,details,status,created_at,listing_id,listings(title)").eq("status", status).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const setReport = async (id: string, s: "resolved" | "dismissed") => {
    const { error } = await supabase.from("reports").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Report ${s}`);
    qc.invalidateQueries({ queryKey: ["admin-reports"] }); qc.invalidateQueries({ queryKey: ["admin-stats"] });
  };
  return (
    <div className={card}>
      <div className="mb-4 flex gap-2">
        {(["open", "resolved", "dismissed"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${status === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{s}</button>
        ))}
      </div>
      {q.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : !q.data?.length ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No {status} reports.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((r) => (
            <li key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.reason}</div>
                  {r.listing_id && <Link to="/listing/$id" params={{ id: r.listing_id }} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{(r.listings as { title?: string } | null)?.title ?? "View listing"} <ExternalLink className="h-3 w-3" /></Link>}
                  {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                  <div className="mt-1 text-xs text-muted-foreground">{timeAgo(r.created_at)}</div>
                </div>
                {r.status === "open" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setReport(r.id, "resolved")}><Check className="mr-1 h-4 w-4" />Resolve</Button>
                    <Button size="sm" variant="outline" onClick={() => setReport(r.id, "dismissed")}>Dismiss</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BannersMod() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", image_url: "", link: "", sort_order: 0 });
  const q = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => (await supabase.from("banners").select("*").order("sort_order")).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-banners"] }); qc.invalidateQueries({ queryKey: ["home-banners"] }); };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    const { error } = await supabase.from("banners").insert({ title: form.title.trim(), image_url: form.image_url.trim() || null, link: form.link.trim() || null, sort_order: Number(form.sort_order) || 0 });
    if (error) return toast.error(error.message);
    setForm({ title: "", image_url: "", link: "", sort_order: 0 }); toast.success("Banner added"); refresh();
  };
  const patch = async (id: string, p: { is_active?: boolean; sort_order?: number }) => {
    const { error } = await supabase.from("banners").update(p).eq("id", id);
    if (error) return toast.error(error.message); refresh();
  };
  const del = async (id: string) => {
    if (!window.confirm("Delete this banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error(error.message); refresh();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className={`${card} grid gap-3 md:grid-cols-2`}>
        <Input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Banner title" />
        <Input placeholder="Image URL (https://…)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} aria-label="Image URL" />
        <Input placeholder="Link (e.g. /marketplace)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} aria-label="Link" />
        <div className="flex gap-2">
          <Input type="number" placeholder="Order" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} aria-label="Sort order" className="w-24" />
          <Button type="submit" className="flex-1"><Plus className="mr-1 h-4 w-4" />Add banner</Button>
        </div>
      </form>
      <div className={card}>
        {!q.data?.length ? <p className="py-6 text-center text-sm text-muted-foreground">No banners yet.</p> : (
          <ul className="divide-y divide-border">
            {q.data.map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-3">
                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-[image:var(--gradient-primary)]">{b.image_url && <img src={b.image_url} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1"><div className="font-medium">{b.title}</div><div className="truncate text-xs text-muted-foreground">{b.link ?? "No link"} · order {b.sort_order}</div></div>
                <Switch checked={b.is_active} onCheckedChange={(v) => patch(b.id, { is_active: v })} aria-label="Active" />
                <Button size="sm" variant="ghost" onClick={() => del(b.id)} aria-label="Delete banner"><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Revenue() {
  return (
    <div className={`${card} py-16 text-center`}>
      <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Payments aren't enabled yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Once M-Pesa and card payments are connected, revenue, commissions and payouts will appear here.</p>
    </div>
  );
}
