import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  MapPin, Heart, Share2, MessageCircle, Phone, ShieldCheck, Flag,
  BadgeCheck, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatKES, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "Listing — Campus Marketplace" },
      { name: "description", content: "View this student listing on Campus Marketplace." },
    ],
  }),
  component: ListingPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Listing not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been removed or sold.</p>
      <Link to="/marketplace" className="mt-6 inline-flex rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Back to marketplace</Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Couldn't load this listing</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
});

function ListingPage() {
  const { id } = Route.useParams();
  const [activeImg, setActiveImg] = useState(0);
  const navigate = useNavigate();
  const [startingChat, setStartingChat] = useState(false);

  const openConversation = async () => {
    if (!data) return;
    setStartingChat(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        navigate({ to: "/auth" });
        return;
      }
      if (uid === data.seller_id) {
        toast.error("You can't message yourself on your own listing.");
        return;
      }
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("listing_id", data.id)
        .eq("buyer_id", uid)
        .eq("seller_id", data.seller_id)
        .maybeSingle();
      let convoId = existing?.id;
      if (!convoId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ listing_id: data.id, buyer_id: uid, seller_id: data.seller_id })
          .select("id")
          .single();
        if (error || !created) {
          toast.error(error?.message || "Couldn't start chat");
          return;
        }
        convoId = created.id;
      }
      navigate({ to: "/messages", search: { c: convoId } });
    } finally {
      setStartingChat(false);
    }
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(`
          id,title,description,price,negotiable,images,condition,location,hostel,county,
          allow_delivery,allow_meetup,created_at,is_featured,seller_id,
          category:categories(name,slug),
          university:universities(name,short_name)
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      const { data: seller } = await supabase
        .from("profiles")
        .select("id,full_name,avatar_url,is_verified,rating,phone,whatsapp,university:universities(name)")
        .eq("id", data.seller_id)
        .maybeSingle();
      return { ...data, seller };
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div className="aspect-square animate-pulse rounded-3xl bg-secondary" />
        <div className="space-y-4">
          <div className="h-8 animate-pulse rounded-lg bg-secondary" />
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
          <div className="h-40 animate-pulse rounded-lg bg-secondary" />
        </div>
      </div>
    );
  }

  if (isError || !data) return null;
  const images = data.images?.length ? data.images : [];
  const seller = data.seller;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <Link to="/marketplace" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Back to marketplace
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Gallery + details */}
        <div>
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
            <div className="relative aspect-square bg-secondary">
              {images[activeImg] ? (
                <img src={images[activeImg]} alt={data.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground">No image provided</div>
              )}
              {data.is_featured && (
                <span className="absolute left-3 top-3 rounded-full bg-[image:var(--gradient-accent)] px-3 py-1 text-xs font-bold uppercase text-accent-foreground shadow">Featured</span>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActiveImg(i)} className={"h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 " + (i === activeImg ? "border-primary" : "border-transparent")}>
                    <img src={src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{data.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {data.location || data.county || "Kenya"}</span>
                  <span>•</span>
                  <span>{timeAgo(data.created_at)}</span>
                  {data.category && <><span>•</span><span className="rounded-full bg-secondary px-2 py-0.5">{data.category.name}</span></>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-primary">{formatKES(data.price)}</div>
                {data.negotiable && <div className="text-xs font-medium text-accent">Negotiable</div>}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <Chip>Condition: <b className="ml-1 capitalize">{String(data.condition).replaceAll("_", " ")}</b></Chip>
              {data.allow_meetup && <Chip>✅ Meet-up</Chip>}
              {data.allow_delivery && <Chip>🚚 Delivery</Chip>}
              {data.university && <Chip>🎓 {data.university.short_name || data.university.name}</Chip>}
              {data.hostel && <Chip>🏠 {data.hostel}</Chip>}
            </div>

            <h2 className="mt-8 text-lg font-bold">Description</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {data.description}
            </p>

            <div className="mt-8 flex items-center gap-2 rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground">
              <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
              <span>Meet in a public campus area. Never send money before receiving the item. Use M-Pesa escrow when in doubt.</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-secondary text-lg font-bold text-muted-foreground">
                {seller?.avatar_url ? (
                  <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (seller?.full_name?.[0] ?? "S").toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-sm font-bold">
                  <span className="truncate">{seller?.full_name || "Student seller"}</span>
                  {seller?.is_verified && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <div className="text-xs text-muted-foreground">
                  {seller?.university?.name || "Verified student"} · ⭐ {Number(seller?.rating ?? 0).toFixed(1)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-2">
              <Button
                onClick={openConversation}
                disabled={startingChat}
                className="h-11 w-full rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {startingChat ? "Opening chat…" : "Message seller"}
              </Button>
              {seller?.whatsapp && (
                <a href={`https://wa.me/${seller.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hi! I'm interested in your listing on Campus Marketplace: " + data.title)}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" className="h-11 w-full rounded-xl">
                    <svg viewBox="0 0 32 32" className="mr-2 h-4 w-4 fill-current text-success"><path d="M16 3C9 3 3 9 3 16c0 3 1 6 3 8L3 32l8-3c2 1 4 2 5 2 7 0 13-6 13-13S23 3 16 3zm7 18c0 1-2 2-3 2s-3 0-8-4-6-8-6-9 1-2 2-2h1c1 0 1 0 2 2s2 3 2 3v1l-1 1v1c1 2 3 3 5 4h1s1-1 2-2h1l3 2v1z"/></svg>
                    WhatsApp
                  </Button>
                </a>
              )}
              {seller?.phone && (
                <a href={`tel:${seller.phone}`}>
                  <Button variant="outline" className="h-11 w-full rounded-xl">
                    <Phone className="mr-2 h-4 w-4" /> Call seller
                  </Button>
                </a>
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <IconAction icon={Heart} label="Save" />
              <IconAction icon={Share2} label="Share" />
              <ReportButton />
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-[image:var(--gradient-primary)] p-6 text-primary-foreground shadow-[var(--shadow-elegant)]">
            <div className="text-xs font-bold uppercase tracking-widest text-white/70">Safety tip</div>
            <p className="mt-2 text-sm">Prefer meeting at a busy campus spot. Inspect the item before paying.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs">{children}</span>;
}

function IconAction({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button className="flex flex-col items-center gap-1 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
function ReportButton() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const report = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return navigate({ to: "/auth" });
    const reason = window.prompt("Why are you reporting this listing? (e.g. scam, spam, prohibited item)");
    if (!reason?.trim()) return;
    const { error } = await supabase.from("reports").insert({ reporter_id: user.id, listing_id: id, reason: reason.trim().slice(0, 200) });
    if (error) return toast.error(error.message);
    toast.success("Thanks — our moderators will review it.");
  };
  return (
    <button onClick={report} className="flex flex-col items-center gap-1 rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
      <Flag className="h-4 w-4" /> Report
    </button>
  );
}
