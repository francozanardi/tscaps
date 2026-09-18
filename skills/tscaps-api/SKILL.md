---
name: tscaps-api
description: Generate videos with burned-in animated subtitles using the Tscaps Automation API. Use when programmatically creating captioned videos, uploading video files via presigned S3/R2 URLs, tracking job status, receiving webhooks, or handling subtitle rendering errors.
---

# Tscaps Automation API Skill

Use the Tscaps Automation API to programmatically generate videos with burned-in animated subtitles, word-level highlights, and typography styles.

- **Base URL:** `https://api.tscaps.io`
- **Authentication:** Bearer token in the `Authorization` header (`Authorization: Bearer <API_KEY>`)
- **Developer Portal:** Manage keys, templates, and minute balance at `https://tscaps.io/app/developers`
- **Documentation:** `https://tscaps.io/docs/api` (or single-file reference at `https://tscaps.io/docs/llms-full.txt`)

---

## 3-Step Integration Workflow

```
1. Video Source (Public URL or POST /v1/automation-jobs/uploads)
                       │
                       ▼
2. Queue Job (POST /v1/automation-jobs)
                       │
                       ▼
3. Result (Webhook notification OR Poll GET /v1/automation-jobs/:id)
                       │
                       ▼
4. Download finished MP4 (downloadUrl valid for 7 days)
```

---

## Code Examples

### JavaScript / TypeScript (Node.js)

```typescript
const API_KEY = process.env.TSCAPS_API_KEY!;
const BASE_URL = 'https://api.tscaps.io';

// 1. Submit a video with a caption template
const createRes = await fetch(`${BASE_URL}/v1/automation-jobs`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    videoUrl: 'https://example.com/input.mp4',
    templateId: 'mira', // Built-in ('mira', 'enzo') or custom ID from /app/developers/templates
    format: 'mp4',
    quality: 'high',
  }),
});

if (!createRes.ok) {
  const error = await createRes.json();
  throw new Error(`Failed to queue job: ${JSON.stringify(error)}`);
}

const job = await createRes.json();
console.log(`Job created: ${job.id}`);

// 2. Poll until finished (or configure webhookUrl in step 1)
while (true) {
  const statusRes = await fetch(`${BASE_URL}/v1/automation-jobs/${job.id}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const state = await statusRes.json();

  if (state.status === 'succeeded') {
    console.log(`Finished video: ${state.downloadUrl}`);
    break;
  }
  if (state.status === 'failed') {
    throw new Error(`Job failed [${state.failureCode}]: ${state.failureReason}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 5000));
}
```

### Python

```python
import os
import time
import requests

API_KEY = os.environ["TSCAPS_API_KEY"]
BASE_URL = "https://api.tscaps.io"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

# 1. Queue a job
res = requests.post(
    f"{BASE_URL}/v1/automation-jobs",
    headers=HEADERS,
    json={
        "videoUrl": "https://example.com/input.mp4",
        "templateId": "mira",  # Built-in ('mira', 'enzo') or custom ID from /app/developers/templates
        "format": "mp4",
        "quality": "high",
    },
)
res.raise_for_status()
job = res.json()
job_id = job["id"]

# 2. Poll for completion
while True:
    status_res = requests.get(
        f"{BASE_URL}/v1/automation-jobs/{job_id}",
        headers={"Authorization": f"Bearer {API_KEY}"},
    )
    status_res.raise_for_status()
    state = status_res.json()

    if state["status"] == "succeeded":
        print(f"Finished video: {state['downloadUrl']}")
        break
    if state["status"] == "failed":
        raise RuntimeError(f"Job failed [{state['failureCode']}]: {state['failureReason']}")

    time.sleep(5)
```

---

## Templates (`templateId`)

The `templateId` parameter in `POST /v1/automation-jobs` specifies the typography, layout, animation, and highlighting style of the subtitles. It accepts either a built-in template name or a custom template ID saved to your account.

- **Recommended built-in templates (most popular):**
  - `mira` (default choice): Clean modern sans-serif with subtle outline and shadow. Versatile for any content.
  - `enzo`: Heavy sans-serif with italic Garamond accents on emphasized words.
  - `loki`: Comic book uppercase with thick black outline and elastic scale bounce.
  - `nova`: Dual-line layout with larger yellow headline and white body text.
  - `naya`: High-impact condensed uppercase with contextual emojis by default.
  - `lewis`: Single-word rapid pop display with cyan/neon accents and emojis by default.
  - `elio`: Tall condensed uppercase with dynamic vertical rise on speech.
  - `vera`: Clean business style with dark backing strip and vibrant blue active pill.
  - `sara`: Historic literary serif with gentle fade-in and scale accents.

For the full catalog of all 38 built-in templates, consult `references/templates.md`.

### Custom Templates (Creating or Modifying a Style)

The API does not accept inline CSS or styling overrides in the JSON request body. When a user asks to modify a style (custom brand colors, typography, margins, animations) or create a new template:

1. **Open the editor:** Go to `https://tscaps.io/app/projects` and upload a video (or open an existing project).
2. **Customize the template:** In the **Templates** tab, select a base style and tune colors, fonts, margins, animations, or write custom CSS directly in the Code tab.
3. **Save the template:** Save it as a new custom template to your account.
4. **Copy the Template ID:** Go to `https://tscaps.io/app/developers/templates`. Your saved templates appear under **"Your templates"** with their unique IDs.
5. **Use in API jobs:** Pass that ID as `templateId` in `POST /v1/automation-jobs`. It can be reused across all future API renders.

---

## Direct File Uploads (When No Public URL Exists)

If the video is on local disk or behind authentication, upload it directly via presigned S3/R2 PUT URL:

1. **Request Upload URL:**
   `POST /v1/automation-jobs/uploads`
   Body: `{ "fileName": "video.mp4", "sizeBytes": 14205000 }`
   Response: `{ "uploadId": "uuid", "uploadUrl": "https://...", "contentType": "video/mp4" }`

2. **Upload Raw Binary (PUT):**
   Send HTTP `PUT` directly to `uploadUrl` with the raw file bytes:
   - `Content-Length` header **must** match `sizeBytes` exactly.
   - `Content-Type` header should match the returned `contentType`.
   - **Do NOT** send an `Authorization` header or API key to `uploadUrl`.
   - **Do NOT** use `multipart/form-data` (FormData); stream raw binary bytes.

   ```bash
   curl -X PUT "$UPLOAD_URL" \
     -H "Content-Type: video/mp4" \
     -H "Content-Length: 14205000" \
     --data-binary @video.mp4
   ```

3. **Queue Job with uploadId:**
   `POST /v1/automation-jobs` with `{ "uploadId": "...", "templateId": "mira" }`.

---

## Webhooks & Signature Verification

Pass `webhookUrl` in `POST /v1/automation-jobs` to receive an instant HTTP callback upon completion.

### Headers sent with each webhook delivery:
- `webhook-id`: Unique message ID (`msg_...`).
- `webhook-timestamp`: Unix epoch seconds timestamp.
- `webhook-signature`: Space-delimited signatures formatted as `v1,<base64-hmac>`.

### Verification (Node.js):
```typescript
import { Webhook } from 'standardwebhooks';

const secret = process.env.TSCAPS_WEBHOOK_SECRET!; // e.g. "whsec_..."
const wh = new Webhook(secret);

// rawBody must be the exact raw Buffer/string (unparsed JSON)
function handleWebhook(req, res) {
  try {
    const payload = wh.verify(req.rawBody, req.headers);
    if (payload.status === 'succeeded') {
      console.log('Finished video:', payload.downloadUrl);
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(400).send('Invalid signature');
  }
}
```

---

## Failure Codes Reference

When a job fails, the response contains `failureCode`:

| `failureCode` | Meaning | Retryable? | Resolution |
| --- | --- | :---: | --- |
| `source-unreachable` | Video URL returned HTTP 4xx/5xx or timed out. | Yes | Verify URL is public and unauthenticated. |
| `source-unreadable` | Downloaded file could not be parsed as video. | No | Ensure file is encoded MP4/WebM/MOV. |
| `source-too-long` | Exceeds plan maximum (3 min Free, 5 min Starter, 10 min Pro). | No | Shorten video or upgrade subscription. |
| `output-larger-than-source` | Requested resolution exceeds source video dimensions. | No | Tscaps does not upscale. Omit resolution or request smaller. |
| `automation-minutes-exhausted` | Account has insufficient automation minutes. | No | Buy more minutes in developer dashboard. |
| `ingest-failed` | Audio extraction or metadata probe failed. | Yes | Check video codec compatibility or retry. |
| `transcription-failed` | Speech recognition error. | Yes | Retry; specify `language` if non-English. |
| `render-failed` | Subtitle frame composition error. | Yes | Transient error; retry. |
| `timed-out` | Exceeded execution deadline. | Yes | Retry job; reduce video duration if persistent. |
| `internal` | Unexpected server error. | Yes | Transient error; safe to retry. |

> **Billing Guarantee:** Failed and cancelled jobs never consume automation minutes. Reserved minutes are refunded immediately.
