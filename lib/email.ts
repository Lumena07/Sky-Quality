/** Optional email via Resend. Set RESEND_API_KEY and EMAIL_FROM; otherwise no-op. */
export const sendEmailOptional = async (params: {
  to: string
  subject: string
  text: string
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> => {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim()
  if (!key || !from) {
    return { ok: true, skipped: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return { ok: false, error: errText || res.statusText }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'send failed' }
  }
}
