import { Link } from "@tanstack/react-router";
import { MapPin, Heart } from "lucide-react";
import { formatKES, timeAgo } from "@/lib/format";

export type ListingCardData = {
  id: string;
  title: string;
  price: number | string;
  images: string[] | null;
  location: string | null;
  created_at: string;
  condition: string;
  is_featured?: boolean | null;
};

export function ListingCard({ item }: { item: ListingCardData }) {
  const img = item.images?.[0];
  return (
    <Link
      to="/listing/$id"
      params={{ id: item.id }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        {img ? (
          <img src={img} alt={item.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">No image</div>
        )}
        {item.is_featured && (
          <span className="absolute left-2 top-2 rounded-full bg-[image:var(--gradient-accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow">
            Featured
          </span>
        )}
        <button
          type="button"
          onClick={(e) => e.preventDefault()}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/80 text-foreground/80 backdrop-blur hover:text-accent"
          aria-label="Save"
        >
          <Heart className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="text-base font-bold text-primary">{formatKES(item.price)}</div>
        <div className="line-clamp-2 min-w-0 text-sm font-medium text-foreground">{item.title}</div>
        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <MapPin className="h-3 w-3 shrink-0" /> {item.location || "Kenya"}
          </span>
          <span className="shrink-0">{timeAgo(item.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}