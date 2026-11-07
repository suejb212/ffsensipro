const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store"
    }
  });

function deviceProfile(brand, model) {
  const b = String(brand || "").toLowerCase();
  const m = String(model || "").toLowerCase();

  let general = 0;
  let redDot = 0;
  let scope = 0;

  // Adjustments based on broad device categories.
  if (b.includes("iphone") || b.includes("apple")) {
    general = -3;
    redDot = -2;
    scope = -2;

    if (/pro|max|air/.test(m)) {
      general -= 2;
      redDot -= 2;
    }
  } else if (b.includes("samsung")) {
    general = 3;
    redDot = 3;

    if (/ultra|s2[3-9]/.test(m)) {
      general -= 5;
      redDot -= 4;
      scope -= 3;
    }
  } else if (
    b.includes("xiaomi") ||
    b.includes("redmi") ||
    b.includes("poco")
  ) {
    general = 4;
    redDot = 3;

    if (/pro|ultra|f[5-9]|x[6-9]/.test(m)) {
      general -= 5;
      redDot -= 4;
      scope -= 2;
    }
  } else if (
    b.includes("rog") ||
    b.includes("oneplus") ||
    b.includes("pixel")
  ) {
    general = -3;
    redDot = -2;
    scope = -2;
  } else {
    general = 3;
    redDot = 2;
    scope = 1;
  }

  return { general, redDot, scope };
}

function generateSettings(row) {
  const profile = deviceProfile(row.brand, row.model);

  const styleOffset = {
    balanced: 0,
    rush: 9,
    headshot: 13,
    sniper: -7
  }[row.style] ?? 0;

  const max = Number(row.scale) === 100 ? 100 : 200;

  const clamp = value =>
    Math.min(max, Math.max(0, Math.round(value * max / 200)));

  return {
    Device: `${row.brand} ${row.model}`,
    "General": clamp(174 + styleOffset + profile.general),
    "Red Dot": clamp(169 + styleOffset + profile.redDot),
    "2X Scope": clamp(
      155 + styleOffset / 2 + profile.scope
    ),
    "4X Scope": clamp(
      137 - styleOffset / 3 + profile.scope
    ),
    "Sniper Scope": clamp(
      80 - styleOffset / 2 + profile.scope
    ),
    "Free Look": clamp(
      140 + styleOffset / 3 + profile.general
    ),
    "Fire Button Size": "41%"
  };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json({ error: "Not configured" }, 503);
  }

  const id = new URL(request.url).searchParams.get("order");

  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    return json({ error: "Invalid order" }, 400);
  }

  try {
    const row = await env.DB.prepare(
      "SELECT * FROM premium_orders WHERE id = ?"
    ).bind(id).first();

    if (!row) {
      return json({ error: "Order not found" }, 404);
    }

    if (row.status === "pending") {
      return json({ error: "Payment not yet verified" }, 202);
    }

    if (row.status !== "paid" && row.status !== "completed") {
      return json({ error: "Payment not available" }, 403);
    }

    // Keep previously generated results unchanged.
    if (row.result) {
      return json({ settings: JSON.parse(row.result) });
    }

    if (row.status === "completed") {
      return json({ error: "Result unavailable" }, 409);
    }

    if (!row.brand || !row.model) {
      return json({ error: "Missing device details" }, 409);
    }

    const settings = generateSettings(row);

    const updated = await env.DB.prepare(`
      UPDATE premium_orders
      SET
        status = 'completed',
        result = ?,
        used_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'paid'
        AND result IS NULL
    `).bind(JSON.stringify(settings), id).run();

    if (!updated.meta?.changes) {
      const latest = await env.DB.prepare(
        "SELECT result FROM premium_orders WHERE id = ?"
      ).bind(id).first();

      if (latest?.result) {
        return json({
          settings: JSON.parse(latest.result)
        });
      }

      return json({ error: "Please retry" }, 503);
    }

    return json({ settings });

  } catch (error) {
    console.error("Premium result error", error);
    return json({ error: "Unable to load premium result" }, 500);
  }
}
