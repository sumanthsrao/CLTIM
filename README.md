# CLTIM — CLAT Topic Image Media

Dedicated repository for **approved, publishable CLAT GK topic image assets**. The main `CLATGK` repository remains separate and must **not** be connected to Netlify.

## Asset convention

```text
images/
  2026-05/
    CL05261T007/
      CL05261T007S04.png
      CL05261T007S06.png
manifest.json
```

Paths above are examples, not assertions that an image has been published.

- Names use canonical topic ID and node ID, with descriptive extensions.
- `manifest.json` maps topic/node IDs to assets, source page, type, publication approval, and public URL.
- Never publish source PDF pages or proprietary publisher artwork without confirming sharing rights.
- Images remain private until individual assets are approved for public hosting.
- When connected to Netlify, configure production branch `main`, no build command, publish directory repository root.
- Any image used by a standalone HTML, PDF or EPUB export should be included in the generated output for offline use.

## Safety

Do not copy topic JSON, prompts, pipeline logs, source PDFs, credentials, or other CLATGK working data here.
