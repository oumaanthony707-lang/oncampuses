import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, ShoppingBag, User, Plus, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => supabase.auth.signOut()}>Sign out</Button>
              <Button size="sm" className="rounded-full bg-[image:var(--gradient-accent)] text-accent-foreground shadow-[var(--shadow-glow)] hover:opacity-95">
                <Plus className="mr-1 h-4 w-4" /> Sell
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="rounded-full">
                  <User className="mr-1 h-4 w-4" /> Sign in
                </Button>
              </Link>
              <Link to="/auth">
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
            <Link to="/auth" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-secondary">
              {signedIn ? "Account" : "Sign in"}
            </Link>
            <Link to="/auth" onClick={() => setOpen(false)} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">+ Sell an item</Link>
          </div>
        </div>
      )}
    </header>
  );
}