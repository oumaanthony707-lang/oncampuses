# Campus Connect Marketplace (36)

Act as a senior Product Manager, UI/UX Designer, Software Architect, and Full-Stack Engineer.

Build a modern, production-ready web application called "Campus Marketplace" — the largest student marketplace in Kenya where university and college students can safely buy and sell items.

GOAL: A responsive, fast, secure, AI-powered marketplace as polished as Jiji, Facebook Marketplace, and Airbnb. Must work perfectly on desktop and mobile.

THEME: Modern, minimal, clean. Blue, white, and orange color palette. Rounded corners, beautiful animations, glassmorphism where appropriate, professional icons, fast loading, dark mode and light mode.

HOMEPAGE: Hero section, search bar, featured products, popular universities, categories, testimonials, statistics, call-to-action, footer.

AUTH: Email login, Google login, phone login, forgot password, email verification.

USER DASHBOARD: Profile photo, bio, university, course, year of study, phone number, WhatsApp button, saved listings, wishlist, notifications, chat inbox, orders, sales, purchase history, wallet, settings.

CATEGORIES: Electronics (phones, laptops, tablets, calculators), Furniture (beds, mattresses, study tables, hostel items), Books (notes, past papers), Clothes, Shoes, Bags, Kitchen appliances, Bicycles, Gaming devices, Services (tutoring, graphic design, programming, photography, printing, laundry, transport).

PRODUCT LISTING: Photos, title, description, condition, price, negotiable toggle, location, university, hostel, category, contact options, delivery option, meet-up option.

SEARCH: AI search with filters by university, county, price, category, condition, distance, newest, popular, verified sellers.

PRODUCT PAGE: Large image gallery, seller info, reviews, location, similar products, save item, share, WhatsApp seller, chat seller, call seller, report listing.

MESSAGING: Real-time chat, typing indicators, image sharing, read receipts, online status.

ADMIN DASHBOARD: Approve/reject listings, delete spam, manage users, manage reports, analytics, revenue dashboard, user statistics, content management, banner management, notifications.

AI FEATURES: AI-generated product descriptions, AI price suggestions, spam detection, fraud detection, duplicate listing detection, smart recommendations, personalized homepage.

PAYMENTS: M-Pesa STK Push, card payments, wallet, escrow payments, subscription payments, commission payments, withdrawal requests.

MONETIZATION: Featured listings, premium seller accounts, sponsored ads, banner advertising, commission on completed sales, university partnerships, affiliate marketing.

SECURITY: Email/phone verification, fraud detection, rate limiting, CAPTCHA, admin moderation, report abuse, secure authentication.

SEO: Fast loading, schema markup, sitemap, meta tags, Open Graph, friendly URLs.

PERFORMANCE: Lazy loading, image optimization, caching, CDN ready, PWA support, offline mode.

PAGES: Home, Marketplace, Categories, Universities, About, Pricing, Blog, Contact, Privacy Policy, Terms of Service, FAQ, Help Center.

TECHNOLOGY: Use Supabase for authentication, database, storage, and realtime chat. Generate SQL tables, Row Level Security policies, storage buckets, edge functions, responsive UI, production-ready reusable components, modern UX, and a scalable database.

Start by scaffolding the core: homepage with hero/search/categories/featured products/footer, Supabase auth (email + Google), the database schema for users/listings/categories/universities/messages, and the marketplace browse + product detail pages. We'll iterate feature-by-feature from there — this is phase 1 of a larger build.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://oncampuses.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a308799a-ded1-47a2-8204-4381f048583f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
