# Gallery · R2 setup

One-time setup for the `/gallery` backing store. You'll end up with:

- A public R2 bucket holding every image + a `manifest.json` index
- Thumbnails served via Cloudflare Image Resizing (`/cdn-cgi/image/...`)
- A local uploader script that scans a folder, uploads new files, and regenerates the manifest

## 1. Create the R2 bucket

1. Open [Cloudflare dash → R2](https://dash.cloudflare.com/?to=/:account/r2/overview).
2. **Create bucket** → name it `imlunahey-gallery` (or whatever — you'll put the name in env). Default location/jurisdiction is fine.
3. Leave everything else at defaults.

## 2. Make it public

Two options, pick one:

### Option A — r2.dev subdomain (quick)

In the bucket's **Settings** tab → **Public Access** → **Allow Access** on the `r2.dev` subdomain. You'll get a URL like:

```
https://pub-xxxxxxxx.r2.dev
```

Put that in `R2_PUBLIC_URL` below. **Note:** r2.dev is rate-limited and not cacheable by the Cloudflare CDN — fine for low traffic, not ideal if the gallery gets hammered.

### Option B — Custom domain (recommended long-term)

In the bucket's **Settings** tab → **Custom Domains** → **Connect Domain** → `gallery.imlunahey.com` (or whatever). Cloudflare auto-creates a CNAME and Cache rules; you get full CDN + Image Resizing on a zone you control.

Put `https://gallery.imlunahey.com` in `R2_PUBLIC_URL`.

You can start on Option A and swap to B later without breaking anything — just update the env var.

## 3. Create an R2 API token

The uploader needs write access. Read access is public, so the site doesn't need a token.

1. **R2 → Manage R2 API Tokens → Create API Token**
2. Permissions: **Object Read & Write**
3. Scope: **Apply to specific buckets only** → select `imlunahey-gallery`
4. TTL: blank (or set if you want)
5. Create. Copy **Access Key ID** + **Secret Access Key** (shown once).
6. Also note your **Account ID** (shown at top of the R2 page, or in the right sidebar of the dash).

## 4. Local env vars

Add to `.env.local` (already gitignored):

```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=imlunahey-gallery
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev     # or https://gallery.imlunahey.com
```

Only `R2_PUBLIC_URL` is needed by the site at runtime (to build image URLs). The `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET` vars are only used by the local uploader script — you do **not** need to set them on your production host.

## 5. Verify Image Resizing

On your **Pro plan**, Image Resizing / Transformations are included. To confirm it's on:

1. Dash → your domain → **Speed → Optimization → Image Resizing**
2. Make sure the toggle is **On** for the zone that serves your R2 public URL (or your `imlunahey.com` zone if you're using a custom domain on R2).

If you stuck with the `r2.dev` URL (Option A), image transforms go through your **`imlunahey.com`** zone's Image Resizing instead — the site serves images via `/cdn-cgi/image/width=400,format=auto/<r2-url>` and Cloudflare fetches + transforms the R2 origin.

## 6. Using the uploader

```bash
# dry-run: shows what would be uploaded
pnpm gallery:plan path/to/photos

# upload new files + regenerate manifest.json
pnpm gallery:upload path/to/photos
```

The script:
- Walks the folder recursively
- Detects `midjourney/**` vs everything else (treats as `photos/` by default) — override with `--kind mj`
- Extracts EXIF (photos) and MJ metadata (prompt, seed, model) where present
- Reads image dimensions and generates a small blurhash
- Computes SHA-256 of the file; key becomes `{kind}/{series?}/{sha}.{ext}`
- Skips files already in the bucket (content-addressed)
- Appends entries to a local `manifest.json` cache under `.gallery-cache/`, then uploads it to R2 root

Run it again any time you add images. Removals need a manual step — see Troubleshooting.

## 7. Manifest shape

```json
{
  "generatedAt": "2026-04-20T18:40:00Z",
  "count": 20137,
  "items": [
    {
      "key": "midjourney/liminal/a3f2...jpg",
      "kind": "mj",
      "series": "liminal",
      "prompt": "empty hotel corridor at 3am…",
      "model": "v6.1",
      "seed": 3914201,
      "createdAt": "2025-09-12T10:31:00Z",
      "w": 1024,
      "h": 1024,
      "blurhash": "L8H2Er?b..."
    },
    {
      "key": "photos/c1e9...jpg",
      "kind": "photo",
      "createdAt": "2024-06-22T08:12:00Z",
      "w": 6000,
      "h": 4000,
      "blurhash": "L02Qv~..."
    }
  ]
}
```

The site fetches `${R2_PUBLIC_URL}/manifest.json` server-side (cached ~1h), then renders. Images are loaded via:

```
${R2_PUBLIC_URL}/cdn-cgi/image/width=400,format=auto/<key>     # thumbnail
${R2_PUBLIC_URL}/<key>                                         # full-res (lightbox)
```

## 8. Troubleshooting

**Images don't load** — check the bucket is public (`Option A` enabled, or `Option B` domain resolves). Paste `${R2_PUBLIC_URL}/manifest.json` into a browser; if you get JSON, the bucket is public and the manifest exists.

**Thumbnails 404** — `/cdn-cgi/image/...` only works on Cloudflare-fronted zones. If your `R2_PUBLIC_URL` is `pub-xxxxxxxx.r2.dev`, the site uses your `imlunahey.com` zone as the Image Resizing endpoint (configured in the server fn) and fetches the r2.dev URL as origin. If that's failing, confirm Image Resizing is enabled on `imlunahey.com` (step 5).

**Uploads fail with `InvalidAccessKeyId`** — Access Key ID got scoped to a different bucket. Recreate the token with the right scope.

**Removing images** — delete the key from the bucket via dash (or `rclone` / `aws s3 rm` with S3-compatible endpoint), then re-run the uploader which will drop orphaned entries from the manifest.

## 9. Minimal R2 S3-compat details (if you use rclone / aws cli)

- **Endpoint**: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
- **Region**: `auto`
- **Signature**: v4

Example rclone config:

```
[r2]
type = s3
provider = Cloudflare
access_key_id = ...
secret_access_key = ...
endpoint = https://<account-id>.r2.cloudflarestorage.com
region = auto
```

Then `rclone ls r2:imlunahey-gallery` should list objects.
