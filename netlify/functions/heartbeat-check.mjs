/**
 * ALMA Dead Man's Switch — Scheduled heartbeat checker
 * Runs daily via Netlify Scheduled Functions.
 *
 * Checks if the author has made a recent check-in.
 * If overdue: records alert in DB + optionally sends email via Resend.
 *
 * Schedule: daily at 08:00 UTC
 *
 * Email alerts:
 *   - 1x interval (30d): email to primary heir (Davi / legacy_admin)
 *   - 2x interval (60d): email to all heirs
 *   - Alerts are sent once per threshold (not repeated daily)
 *
 * Env vars (optional):
 *   RESEND_API_KEY — Resend.com API key for email delivery
 *   HEARTBEAT_NOTIFY_EMAILS — comma-separated fallback emails
 */

import { neon } from '@neondatabase/serverless';

export const config = {
  schedule: "0 8 * * *"  // Every day at 08:00 UTC
};

export default async function handler() {
  const dbUrl = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Heartbeat] No database configured');
    return new Response('No DB', { status: 200 });
  }

  const sql = neon(dbUrl);

  try {
    // Get last check-in
    const lastRow = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_last' LIMIT 1`;
    if (lastRow.length === 0) {
      console.log('[Heartbeat] No check-in ever recorded — skipping');
      return new Response('No heartbeat yet', { status: 200 });
    }

    const lastCheckin = new Date(lastRow[0].value);
    const daysSince = Math.floor((Date.now() - lastCheckin.getTime()) / 86400000);

    // Get interval
    const intervalRow = await sql`SELECT value FROM alma_config WHERE key = 'heartbeat_interval_days' LIMIT 1`;
    const interval = intervalRow.length > 0 ? parseInt(intervalRow[0].value) : 30;

    console.log(`[Heartbeat] Last check-in: ${daysSince} days ago (interval: ${interval}d)`);

    if (daysSince <= interval) {
      console.log('[Heartbeat] OK — within interval');
      return new Response('OK', { status: 200 });
    }

    // --- OVERDUE ---
    const severity = daysSince >= interval * 2 ? 'critical' : 'warning';

    // Check if we already sent alert for this threshold
    const alertKey = `heartbeat_alert_${severity}`;
    const alertRow = await sql`SELECT value FROM alma_config WHERE key = ${alertKey} LIMIT 1`;
    if (alertRow.length > 0) {
      const lastAlert = JSON.parse(alertRow[0].value);
      const alertAge = Math.floor((Date.now() - new Date(lastAlert.sentAt).getTime()) / 86400000);
      if (alertAge < interval) {
        console.log(`[Heartbeat] ${severity} alert already sent ${alertAge}d ago — skipping`);
        return new Response('Alert already sent', { status: 200 });
      }
    }

    // Record alert in DB
    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES (${alertKey}, ${JSON.stringify({
        severity,
        daysSince,
        lastCheckin: lastCheckin.toISOString(),
        sentAt: new Date().toISOString(),
      })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    // Record visible alert for legacy page
    await sql`
      INSERT INTO alma_config (key, value, updated_at)
      VALUES ('heartbeat_overdue', ${JSON.stringify({
        overdue: true,
        daysSince,
        severity,
        checkedAt: new Date().toISOString(),
      })}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;

    console.log(`[Heartbeat] ALERT: ${severity} — ${daysSince} days since last check-in`);

    // --- Activate legacy mode if critical (3x interval) ---
    const activationThreshold = interval * 3;
    if (daysSince >= activationThreshold) {
      await sql`
        INSERT INTO alma_config (key, value, updated_at)
        VALUES ('legacy_mode_active', ${JSON.stringify({
          activated: true,
          activatedAt: new Date().toISOString(),
          daysSince,
        })}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
      console.log(`[Heartbeat] LEGACY MODE ACTIVATED — ${daysSince} days`);
    }

    // --- Send email if Resend API key is configured ---
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      // Get heir emails from alma_legacy table
      let emails = [];

      if (severity === 'critical') {
        const heirs = await sql`SELECT person, email FROM alma_legacy WHERE email IS NOT NULL AND email != '' AND (notify IS NULL OR notify = true)`;
        emails = heirs.map(h => ({ email: h.email, person: h.person }));
      } else {
        // Warning: only primary heir (legacy_admin)
        const primary = await sql`SELECT person, email FROM alma_legacy WHERE access_level = 'legacy_admin' AND email IS NOT NULL AND (notify IS NULL OR notify = true) LIMIT 1`;
        if (primary.length > 0) emails = [{ email: primary[0].email, person: primary[0].person }];
      }

      // Fallback to env var
      if (emails.length === 0 && process.env.HEARTBEAT_NOTIFY_EMAILS) {
        emails = process.env.HEARTBEAT_NOTIFY_EMAILS.split(',').map(e => ({ email: e.trim(), person: 'Herdeiro' }));
      }

      if (emails.length > 0) {
        const siteUrl = process.env.ALLOWED_ORIGIN || 'https://projeto-alma.netlify.app';

        for (const heir of emails) {
          const subject = severity === 'critical'
            ? `ALMA — ${heir.person}, chegou a hora`
            : `ALMA — Aviso para ${heir.person}`;

          const body = severity === 'critical'
            ? `${heir.person},\n\nO autor do ALMA nao faz check-in ha ${daysSince} dias.\n\nIsso pode significar que algo aconteceu.\n\nSe voce recebeu uma frase-chave pessoal, acesse:\n${siteUrl}/legacy\n\nDigite a frase que ele te deixou.\n\nCom amor — ALMA`
            : `${heir.person},\n\nO autor do ALMA nao faz check-in ha ${daysSince} dias (intervalo normal: ${interval} dias).\n\nIsso pode ser apenas esquecimento. Tente entrar em contato diretamente.\n\nSe necessario, voce sabe onde encontra-lo: ${siteUrl}/legacy\n\n— ALMA`;

          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
              body: JSON.stringify({
                from: 'ALMA <noreply@resend.dev>',
                to: heir.email,
                subject,
                text: body,
              }),
            });
            console.log(`[Heartbeat] Email sent to ${heir.person} (${heir.email})`);
          } catch (e) {
            console.error(`[Heartbeat] Failed to email ${heir.person}:`, e.message);
          }
        }
      } else {
        console.log('[Heartbeat] No emails configured — alert saved to DB only');
      }
    } else {
      console.log('[Heartbeat] No RESEND_API_KEY — alert saved to DB only');
    }

    return new Response(`Alert: ${severity}`, { status: 200 });
  } catch (e) {
    console.error('[Heartbeat] Error:', e.message);
    return new Response('Error', { status: 500 });
  }
}
