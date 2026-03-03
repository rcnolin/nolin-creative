interface Env {
  RESEND_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
  MAIL_TO: string;
  MAIL_FROM: string;
}

export const onRequestPost: PagesFunction<Env> = async ({
  request,
  env,
}) => {
  const form = await request.formData();

  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim();
  const message = String(form.get("message") || "").trim();
  const token = String(form.get("cf-turnstile-response") || "").trim();

  if (!name || !email || !message) {
    return new Response("Missing required fields.", { status: 400 });
  }

  if (!token) {
    return new Response("Turnstile token missing.", { status: 400 });
  }

  // Verify Turnstile
  const ip = request.headers.get("CF-Connecting-IP") || "";

  const verifyRes = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
    }
  );

  const verifyJson: any = await verifyRes.json();

  if (!verifyJson?.success) {
    return new Response("Turnstile verification failed.", { status: 403 });
  }

  // Send email via Resend
  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [env.MAIL_TO],
      subject: `Nolin Creative inquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      reply_to: email,
    }),
  });

  if (!sendRes.ok) {
    const err = await sendRes.text();
    return new Response(`Email failed: ${err}`, { status: 502 });
  }

  return new Response(null, {
    status: 303,
    headers: { Location: "/contact?sent=1" },
  });
};