import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Search, ShieldCheck, Zap, Users, Star, ArrowRight,
  Smartphone, Sofa, BookOpen, Shirt, Footprints, Backpack,
  Utensils, Bike, Gamepad2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ListingCard, type ListingCardData } from "@/components/listing-card";
import heroImg from "@/assets/hero-marketplace.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electronics: Smartphone,
  furniture: Sofa,
  books: BookOpen,
  clothes: Shirt,
  shoes: Footprints,
  bags: Backpack,
  kitchen: Utensils,
  bicycles: Bike,
  gaming: Gamepad2,
  services: Sparkles,
};

function Index() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const featured = useQuery({
    queryKey: ["featured-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("id,title,price,images,location,created_at,condition,is_featured")
        .eq("status", "active")
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as ListingCardData[];
    },
  });

  const categories = useQuery({
    queryKey: ["home-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,slug,icon,sort_order").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const universities = useQuery({
    queryKey: ["home-universities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("universities").select("id,name,short_name,county").limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/marketplace", search: { q: q || undefined } as never });
  };

  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={heroImg} alt="" className="h-full w-full object-cover" fetchPriority="high" />
          <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-90" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
          <div className="max-w-3xl text-primary-foreground">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Trusted by students in 40+ Kenyan campuses
            </div>
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Buy & sell anything, <span className="text-accent-glow">safely</span>, right on campus.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/85 sm:text-lg">
              Kenya's biggest student marketplace. From laptops and lecture notes to hostel items and side gigs — all in one place.
            </p>

            <form onSubmit={submitSearch} className="mt-8 flex flex-col gap-2 rounded-2xl bg-background/95 p-2 shadow-[var(--shadow-elegant)] backdrop-blur sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="What are you looking for?"
                  className="h-12 w-full rounded-xl bg-transparent pl-12 pr-3 text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-xl bg-[image:var(--gradient-accent)] px-6 text-accent-foreground shadow-[var(--shadow-glow)] hover:opacity-95">
                Search
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3 text-white/90">
              <Stat value="15K+" label="Active listings" />
              <Stat value="40+" label="Universities" />
              <Stat value="8K+" label="Verified sellers" />
              <Stat value="4.8★" label="Buyer rating" />
            </div>
          </div>
        </div>
      </section>
      <HomeBanners />

      {/* CATEGORIES */}
      <section id="categories" className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <SectionHeader eyebrow="Explore" title="Shop by category" href="/marketplace" />
        <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10">
          {(categories.data ?? []).map((c) => {
            const Icon = CATEGORY_ICONS[c.slug] ?? Sparkles;
            return (
              <Link
                key={c.id}
                to="/marketplace"
                search={{ category: c.slug } as never}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 text-center shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]"
              >
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground transition group-hover:scale-105">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-semibold text-foreground">{c.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
        <SectionHeader eyebrow="Fresh" title="Latest listings" href="/marketplace" />
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {featured.isLoading &&
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-secondary" />
            ))}
          {featured.data?.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
              No listings yet — be the first to sell something.
            </div>
          )}
          {featured.data?.map((item) => <ListingCard key={item.id} item={item} />)}
        </div>
      </section>

      {/* UNIVERSITIES */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeader eyebrow="Popular" title="Universities on Campus Marketplace" />
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {(universities.data ?? []).map((u) => (
            <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
              <div className="text-sm font-bold text-foreground">{u.short_name || u.name}</div>
              <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">{u.name}</div>
              <div className="mt-3 inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{u.county}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          <Feature icon={ShieldCheck} title="Safe & verified" desc="Every seller is a verified Kenyan student. Report abuse anytime." />
          <Feature icon={Zap} title="Fast M-Pesa payments" desc="STK Push checkout, escrow protection, and instant withdrawal." />
          <Feature icon={Users} title="Meet on campus" desc="Filter by hostel, university and county — no long deliveries needed." />
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeader eyebrow="Students love it" title="What our users say" />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="flex gap-0.5 text-accent">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
              <p className="mt-3 text-sm text-foreground/90">“{t.quote}”</p>
              <div className="mt-4 text-xs font-medium text-muted-foreground">{t.name} • {t.uni}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[image:var(--gradient-hero)] p-10 text-primary-foreground shadow-[var(--shadow-elegant)] sm:p-14">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-3xl font-black tracking-tight sm:text-4xl">Ready to make your first sale?</h3>
              <p className="mt-2 max-w-xl text-white/85">Post a listing in under 60 seconds. Reach thousands of students on your campus today.</p>
            </div>
            <Link to="/sell">
              <Button size="lg" className="rounded-full bg-white px-8 text-primary hover:bg-white/90">
                Start selling <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs uppercase tracking-wider text-white/70">{label}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, href }: { eyebrow: string; title: string; href?: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-accent">{eyebrow}</div>
        <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
      </div>
      {href && (
        <Link to={href} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline sm:inline-flex">
          View all <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

const TESTIMONIALS = [
  { name: "Amina W.", uni: "University of Nairobi", quote: "Sold my old laptop in 2 days to a classmate. Way easier than posting in WhatsApp groups!" },
  { name: "Brian K.", uni: "JKUAT", quote: "Found second-hand engineering notes at half the bookshop price. Life saver during exams." },
  { name: "Cynthia M.", uni: "Kenyatta University", quote: "The M-Pesa escrow made the deal feel super safe. Will use again next semester." },
];

function HomeBanners() {
  const q = useQuery({
    queryKey: ["home-banners"],
    queryFn: async () => (await supabase.from("banners").select("id,title,image_url,link").eq("is_active", true).order("sort_order")).data ?? [],
  });
  if (!q.data?.length) return null;
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-8">
      <div className="flex snap-x gap-4 overflow-x-auto">
        {q.data.map((b) => {
          const inner = (
            <div className="relative h-36 w-[85vw] max-w-xl shrink-0 snap-start overflow-hidden rounded-3xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-elegant)] md:h-44">
              {b.image_url && <img src={b.image_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
              <div className="absolute bottom-4 left-5 text-lg font-bold text-background">{b.title}</div>
            </div>
          );
          return b.link ? <a key={b.id} href={b.link}>{inner}</a> : <div key={b.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}
