import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search, SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ListingCard, type ListingCardData } from "@/components/listing-card";

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  university: z.string().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc"]).optional(),
});

export const Route = createFileRoute("/marketplace")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Marketplace — Browse student listings | Campus Marketplace" },
      { name: "description", content: "Browse thousands of items and services from verified Kenyan university students. Filter by category, university, price and more." },
      { property: "og:title", content: "Marketplace — Browse student listings" },
      { property: "og:description", content: "Thousands of items and services from Kenyan university students." },
    ],
  }),
  component: MarketplacePage,
});

function MarketplacePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name,slug").order("sort_order")).data ?? [],
  });

  const listings = useQuery({
    queryKey: ["listings", search],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select("id,title,price,images,location,created_at,condition,is_featured,category:categories(slug)")
        .eq("status", "active");

      if (search.q) query = query.ilike("title", `%${search.q}%`);

      switch (search.sort) {
        case "price_asc": query = query.order("price", { ascending: true }); break;
        case "price_desc": query = query.order("price", { ascending: false }); break;
        default: query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
      }

      const { data, error } = await query.limit(60);
      if (error) throw error;
      let rows = (data ?? []) as (ListingCardData & { category: { slug: string } | null })[];
      if (search.category) rows = rows.filter((r) => r.category?.slug === search.category);
      return rows;
    },
  });

  type S = z.infer<typeof searchSchema>;
  const setSearch = (partial: Partial<S>) => {
    navigate({ search: (prev: S) => ({ ...prev, ...partial }) });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Marketplace</h1>
        <p className="mt-1 text-sm text-muted-foreground">Discover what students near you are selling right now.</p>
      </div>

      {/* Search + sort */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            defaultValue={search.q ?? ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSearch({ q: (e.target as HTMLInputElement).value || undefined });
            }}
            placeholder="Search listings…"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <select
            value={search.sort ?? "newest"}
            onChange={(e) => setSearch({ sort: e.target.value as never })}
            className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
      </div>

      {/* Category pills */}
      <div id="categories" className="mb-8 flex flex-wrap gap-2 scroll-mt-20">
        <Pill active={!search.category} onClick={() => setSearch({ category: undefined })}>All</Pill>
        {categories.data?.map((c) => (
          <Pill key={c.id} active={search.category === c.slug} onClick={() => setSearch({ category: c.slug })}>{c.name}</Pill>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {listings.isLoading &&
          Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-secondary" />
          ))}
        {!listings.isLoading && listings.data?.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
            <div className="text-lg font-semibold">No listings found</div>
            <p className="mt-1 text-sm text-muted-foreground">Try a different search or category.</p>
            <Link to="/sell" className="mt-4 inline-flex rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground">Sell an item</Link>
          </div>
        )}
        {listings.data?.map((item) => <ListingCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function Pill({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-full border px-4 py-1.5 text-sm font-medium transition " +
        (active
          ? "border-primary bg-primary text-primary-foreground shadow-[var(--shadow-elegant)]"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}