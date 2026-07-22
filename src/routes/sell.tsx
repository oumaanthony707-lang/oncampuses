import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, X, GripVertical, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Condition = Database["public"]["Enums"]["listing_condition"];

const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "new", label: "Brand new" },
  { value: "like_new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "for_parts", label: "For parts / not working" },
];

const MAX_PHOTOS = 8;
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Post a listing — Campus Marketplace" },
      { name: "description", content: "Sell something to fellow Kenyan students in under a minute. Upload photos, set your price and reach thousands of buyers." },
      { property: "og:title", content: "Post a listing — Campus Marketplace" },
      { property: "og:description", content: "Sell something to fellow Kenyan students in under a minute." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SellPage,
});

type Photo = { id: string; file: File; preview: string };

function SellPage() {
  const navigate = useNavigate();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      setUserId(data.session.user.id);
      setCheckingAuth(false);
    });
  }, [navigate]);

  const categoriesQ = useQuery({
    queryKey: ["sell-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name,slug").order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const universitiesQ = useQuery({
    queryKey: ["sell-universities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("universities").select("id,name,short_name,county").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(true);
  const [universityId, setUniversityId] = useState("");
  const [location, setLocation] = useState("");
  const [hostel, setHostel] = useState("");
  const [county, setCounty] = useState("");
  const [allowDelivery, setAllowDelivery] = useState(false);
  const [allowMeetup, setAllowMeetup] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS} photos`);
      return;
    }
    const accepted: Photo[] = [];
    for (const f of list.slice(0, room)) {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} is not an image`);
        continue;
      }
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} is larger than 5 MB`);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file: f,
        preview: URL.createObjectURL(f),
      });
    }
    setPhotos((p) => [...p, ...accepted]);
  };

  const removePhoto = (id: string) => {
    setPhotos((p) => {
      const target = p.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return p.filter((x) => x.id !== id);
    });
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setPhotos((p) => {
      const next = [...p];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const validate = () => {
    if (photos.length < 1) return "Add at least one photo";
    if (!title.trim() || title.trim().length < 4) return "Title must be at least 4 characters";
    if (!description.trim() || description.trim().length < 10) return "Description must be at least 10 characters";
    if (!categoryId) return "Choose a category";
    if (!universityId) return "Choose your university";
    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed <= 0) return "Enter a valid price in KES";
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSubmitting(true);
    try {
      // Upload photos
      const uploadedUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const ext = photo.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const path = `${userId}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("listing-images")
          .upload(path, photo.file, { cacheControl: "31536000", upsert: false, contentType: photo.file.type });
        if (upErr) throw upErr;
        const { data: signed, error: signErr } = await supabase.storage
          .from("listing-images")
          .createSignedUrl(path, TEN_YEARS);
        if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Failed to sign URL");
        uploadedUrls.push(signed.signedUrl);
      }

      const { data: inserted, error: insErr } = await supabase
        .from("listings")
        .insert({
          seller_id: userId,
          title: title.trim(),
          description: description.trim(),
          category_id: categoryId,
          condition,
          price: Number(price),
          negotiable,
          university_id: universityId,
          location: location.trim() || null,
          hostel: hostel.trim() || null,
          county: county.trim() || null,
          allow_delivery: allowDelivery,
          allow_meetup: allowMeetup,
          images: uploadedUrls,
          status: "active",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      toast.success("Listing posted!");
      navigate({ to: "/listing/$id", params: { id: inserted.id } });
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-widest text-accent">Sell an item</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Post a new listing</h1>
        <p className="mt-2 text-sm text-muted-foreground">Great photos and clear details sell fastest. Aim for at least 3 photos in good light.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* PHOTOS */}
        <Section title="Photos" hint="Up to 8. First photo is the cover.">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/40"
            }`}
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div className="mt-3 text-sm font-semibold">Drag photos here or tap to upload</div>
            <div className="mt-1 text-xs text-muted-foreground">JPG, PNG or WEBP · up to 5 MB each</div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="mt-4 rounded-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={photos.length >= MAX_PHOTOS}
            >
              <ImagePlus className="mr-2 h-4 w-4" /> Choose photos
            </Button>
          </div>

          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((p, idx) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => (dragIndex.current = idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) reorder(dragIndex.current, idx);
                    dragIndex.current = null;
                  }}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-secondary shadow-[var(--shadow-card)]"
                >
                  <img src={p.preview} alt="" className="h-full w-full object-cover" />
                  {idx === 0 && (
                    <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/95 text-foreground opacity-0 shadow transition group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <span className="pointer-events-none absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-md bg-background/90 text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100">
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* DETAILS */}
        <Section title="Details">
          <div className="space-y-4">
            <Labeled label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g. MacBook Air M1, 256GB, excellent condition"
                maxLength={120}
                className={inputCls}
              />
            </Labeled>
            <Labeled label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Condition, what's included, why you're selling, meet-up options…"
                rows={6}
                maxLength={2000}
                className={`${inputCls} min-h-[140px] resize-y py-3`}
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">{description.length}/2000</div>
            </Labeled>
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Category">
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectCls}>
                  <option value="">Select a category</option>
                  {(categoriesQ.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Labeled>
              <Labeled label="Condition">
                <select value={condition} onChange={(e) => setCondition(e.target.value as Condition)} className={selectCls}>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Labeled>
            </div>
          </div>
        </Section>

        {/* PRICE */}
        <Section title="Price">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Labeled label="Price (KES)">
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">KSh</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="5000"
                  className={`${inputCls} pl-12`}
                />
              </div>
            </Labeled>
            <ToggleRow label="Negotiable" checked={negotiable} onChange={setNegotiable} />
          </div>
        </Section>

        {/* LOCATION */}
        <Section title="Location">
          <div className="space-y-4">
            <Labeled label="University">
              <select value={universityId} onChange={(e) => setUniversityId(e.target.value)} className={selectCls}>
                <option value="">Select your university</option>
                {(universitiesQ.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.short_name ? `${u.short_name} — ${u.name}` : u.name}</option>
                ))}
              </select>
            </Labeled>
            <div className="grid gap-4 sm:grid-cols-3">
              <Labeled label="Area / Location">
                <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kikuyu, Roysambu…" className={inputCls} />
              </Labeled>
              <Labeled label="Hostel (optional)">
                <input value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="Hall 9, Qwetu…" className={inputCls} />
              </Labeled>
              <Labeled label="County (optional)">
                <input value={county} onChange={(e) => setCounty(e.target.value)} placeholder="Nairobi" className={inputCls} />
              </Labeled>
            </div>
          </div>
        </Section>

        {/* DELIVERY */}
        <Section title="How buyers can get it">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Meet-up available" checked={allowMeetup} onChange={setAllowMeetup} />
            <ToggleRow label="Delivery available" checked={allowDelivery} onChange={setAllowDelivery} />
          </div>
        </Section>

        <div className="flex flex-col-reverse items-stretch justify-end gap-3 pt-2 sm:flex-row sm:items-center">
          <Button type="button" variant="outline" className="rounded-full" onClick={() => navigate({ to: "/marketplace" })} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="rounded-full bg-[image:var(--gradient-accent)] px-8 text-accent-foreground shadow-[var(--shadow-glow)] hover:opacity-95"
            disabled={submitting}
          >
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting…</> : "Post listing"}
          </Button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";
const selectCls =
  "h-12 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
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

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex h-12 items-center justify-between rounded-xl border px-4 text-sm font-medium transition ${
        checked ? "border-primary/40 bg-primary/5 text-foreground" : "border-border bg-background text-muted-foreground"
      }`}
      aria-pressed={checked}
    >
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-primary" : "bg-secondary"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}