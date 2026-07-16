import { Link } from "@tanstack/react-router";
import { ShoppingBag, Instagram, Twitter, Facebook } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-lg font-black tracking-tight">Campus<span className="text-accent">Market</span></span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Kenya's biggest student marketplace. Buy and sell safely on campus.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="#" className="grid h-9 w-9 place-items-center rounded-full bg-background text-muted-foreground shadow-sm hover:text-primary" aria-label="Instagram"><Instagram className="h-4 w-4" /></a>
            <a href="#" className="grid h-9 w-9 place-items-center rounded-full bg-background text-muted-foreground shadow-sm hover:text-primary" aria-label="Twitter"><Twitter className="h-4 w-4" /></a>
            <a href="#" className="grid h-9 w-9 place-items-center rounded-full bg-background text-muted-foreground shadow-sm hover:text-primary" aria-label="Facebook"><Facebook className="h-4 w-4" /></a>
          </div>
        </div>
        <FooterCol title="Marketplace" links={[["Browse all", "/marketplace"], ["Categories", "/marketplace"], ["Universities", "/marketplace"], ["Sell an item", "/auth"]]} />
        <FooterCol title="Company" links={[["About", "/"], ["Blog", "/"], ["Contact", "/"], ["Careers", "/"]]} />
        <FooterCol title="Support" links={[["Help center", "/"], ["Safety tips", "/"], ["Privacy", "/"], ["Terms", "/"]]} />
      </div>
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Campus Marketplace. Made for students, by students in Kenya.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link to={href} className="transition hover:text-foreground">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}