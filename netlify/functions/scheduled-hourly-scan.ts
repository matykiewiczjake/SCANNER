import type { Handler } from "@netlify/functions";

export const handler: Handler = async () => {
  const site = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!site) return { statusCode: 500, body: "Missing URL env" };
  if (!secret) return { statusCode: 500, body: "Missing CRON_SECRET" };

  const res = await fetch(`${site}/api/cron/hourly-scan`, {
    method: "POST",
    headers: { "x-cron-secret": secret },
  });

  return {
    statusCode: res.ok ? 200 : 500,
    body: await res.text(),
  };
};
