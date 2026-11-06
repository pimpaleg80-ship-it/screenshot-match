# FlowPeople HRMS — Deployment & Maintenance Runbook

**Hosting Platform**: Cloudflare Pages (Nitro Preset `cloudflare-pages`)  
**Database**: Supabase Managed PostgreSQL (`mnnecoyqofhrivxufhqm.supabase.co`)  
**Package Manager & Runtime**: Bun / Node.js

---

## 1. Cloudflare Pages Deployment Workflow

### 1. Build Verification

```bash
bun run build
```

Creates `dist/` with `_worker.js`, `_routes.json`, and static assets.

### 2. Cloudflare Pages Settings

- **Build Command**: `bun run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_SUPABASE_URL`: `https://mnnecoyqofhrivxufhqm.supabase.co`
  - `VITE_SUPABASE_ANON_KEY`: `<SUPABASE_ANON_KEY>`
  - `NITRO_PRESET`: `cloudflare-pages`

---

## 2. Supabase Free Tier Capacity & Maintenance

For an initial 25-employee production pilot:

- **Database Storage**: Uses ~1.5 MB/month (< 4% of 500 MB free tier limit).
- **Monthly GPS Log Purge**: Scheduled function `public.cleanup_expired_gps_logs()` safely removes raw `geofence_events` older than 90 days.
- **Permanent Canonical Ledger**: Canonical attendance rows (`attendance`, `attendance_monthly_summaries`) are permanent and legal.
- **Drive Archival**: Historical monthly PDF reports are archived directly to Google Drive, ensuring zero long-term storage load on Supabase.
