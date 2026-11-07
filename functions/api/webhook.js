const enc = new TextEncoder();

const hex = bytes =>
  Array.from(new Uint8Array(bytes), b =>
    b.toString(16).padStart(2, "0")
  ).join("");

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (
    !env.DB ||
    !env.LEMON_WEBHOOK_SECRET ||
    !env.LEMON_STORE_ID ||
    !env.LEMON_VARIANT_ID
  ) {
    return new Response("Not configured", { status: 503 });
  }

  try {
    const raw = await request.text();
    const signature = request.headers.get("X-Signature") || "";

    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(env.LEMON_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expected = hex(
      await crypto.subtle.sign("HMAC", key, enc.encode(raw))
    );

    if (!safeEqual(signature.toLowerCase(), expected)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const payload = JSON.parse(raw);

    if (payload.meta?.event_name !== "order_created") {
      return new Response("Ignored", { status: 200 });
    }

    const id = payload.meta?.custom_data?.order_id;
    const order = payload.data;
    const a = order?.attributes;

    if (!id || !order?.id || !a) {
      return new Response("Invalid order", { status: 400 });
    }

    const valid =
      a.status === "paid" &&
      String(a.store_id) === String(env.LEMON_STORE_ID) &&
      String(a.first_order_item?.variant_id) ===
        String(env.LEMON_VARIANT_ID) &&
      String(a.currency || "").toUpperCase() === "EUR" &&
      Number(a.total) === 499;

    if (!valid) {
      return new Response("Order not eligible", { status: 200 });
    }

    await env.DB.prepare(`
      UPDATE premium_orders
      SET
        status = 'paid',
        order_id = ?,
        paid_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'pending'
    `).bind(String(order.id), String(id)).run();

    return new Response("OK", { status: 200 });

  } catch (error) {
    console.error("Webhook processing failed", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}
