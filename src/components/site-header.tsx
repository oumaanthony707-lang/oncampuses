import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ShoppingBag, User, Plus, Menu, X, Bell, LayoutDashboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setUserId(data.session?.user.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const unreadQ = useQuery({
    queryKey: ["unread-notifications", userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("is_read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const unread = unreadQ.data ?? 0;

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/marketplace", search: { q: q || undefined } as never });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <span className="hidden text-lg font-black tracking-tight sm:inline">
            Campus<span className="text-accent">Market</span>
          </span>
        </Link>

        <form onSubmit={submitSearch} className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search laptops, notes, hostels…"
            className="h-10 w-full rounded-full border border-border bg-secondary/60 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-4 focus:ring-primary/15"
          />
        </form>

        <nav className="hidden items-center gap-1 md:flex">
          <Link to="/marketplace" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground">Browse</Link>
          <a href="/marketplace#categories" className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground">Categories</a>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <>
              <Link to="/dashboard" search={{ tab: "notifications" }} className="relative rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="rounded-full">
                  <LayoutDashboard className="mr-1 h-4 w-4" /> Dashboard
                </Button>
              </Link>
              <Link to="/sell">
                <Button size="sm" className="rounded-full bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-glow)] hover:opacity-95">
                  <Plus className="mr-1 h-4 w-4" /> Sell
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="rounded-full">
                  <User className="mr-1 h-4 w-4" /> Sign in
                </Button>
              </Link>
              <Link to="/sell">
                <Button size="sm" className="rounded-full bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-glow)] hover:opacity-95">
                  <Plus className="mr-1 h-4 w-4" /> Sell
                </Button>
              </Link>
            </>
          )}
        </div>

        <button className="rounded-full p-2 md:hidden" onClick={() => setOpen((v) => !v)} aria-label="Menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            <Link to="/marketplace" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">Browse</Link>
            {signedIn ? (
              <>
                <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">Dashboard</Link>
                <Link to="/dashboard" search={{ tab: "notifications" }} onClick={() => setOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">
                  <span>Notifications</span>
                  {unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <Link to="/auth" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">Sign in</Link>
            )}
            <Link to="/sell" onClick={() => setOpen(false)} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">+ Sell an item</Link>
          </div>
        </div>
      )}
    </header>
  );
}