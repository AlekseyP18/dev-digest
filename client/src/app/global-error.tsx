/* Last-resort boundary for errors in the root layout itself (providers, i18n).
   Replaces <html>, so it can't rely on providers, next-intl or the design
   system — plain markup, English only. */
"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>DevDigest failed to load</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>An unexpected error broke the app shell. Reload to try again.</p>
          <button type="button" onClick={reset} style={{ padding: "8px 14px", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
