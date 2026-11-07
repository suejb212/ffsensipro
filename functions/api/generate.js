
const AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

export async function onRequestPost({ request, env }) {
  try {
    if (!env.AI) {
      return Response.json(
        { error: "AI binding is missing" },
        { status: 503 }
      );
    }

    const body = await request.json();

    const brand = String(body.brand || "").slice(0, 60);
    const model = String(body.model || "").slice(0, 80);
    const ram = String(body.ram || "4");
    const hz = String(body.refreshRate || body.hz || "60");
    const style = String(body.playStyle || body.style || "balanced");
    const scale = Number(body.scale) === 100 ? 100 : 200;

    if (!brand || !model) {
      return Response.json(
        { error: "Phone brand and model required" },
        { status: 400 }
      );
    }

    const prompt = `Recommend Free Fire sensitivity
settings for this device.

Brand: ${brand}
Model: ${model}
RAM: ${ram} GB
Refresh rate: ${hz} Hz
Play style: ${style}
Sensitivity range: 0-${scale}

Return only JSON with numeric fields:
general, redDot, scope2x, scope4x,
sniperScope, freeLook, fireButtonSize, dpi.

Sensitivity values: 0-${scale}.
Fire button size: 20-70.
DPI: 300-650.

These are estimated starting recommendations,
not verified device-specific settings.`;

    const response = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content: "Return one valid JSON object only. No markdown."
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 450,
      temperature: 0.2
    });

    const raw = typeof response.response === "string"
      ? response.response
      : JSON.stringify(response);

    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("No JSON returned");

    const parsed = JSON.parse(match[0]);
    const keys = [
      "general", "redDot", "scope2x", "scope4x",
      "sniperScope", "freeLook", "fireButtonSize", "dpi"
    ];

    const settings = {};

    for (const key of keys) {
      const value = Number(parsed[key]);

      if (!Number.isFinite(value)) {
        throw new Error("Invalid field: " + key);
      }

      const min = key === "dpi" ? 300 :
        key === "fireButtonSize" ? 20 : 0;

      const max = key === "dpi" ? 650 :
        key === "fireButtonSize" ? 70 : scale;

      settings[key] = Math.round(
        Math.min(max, Math.max(min, value))
      );
    }

    return Response.json({
      success: true,
      settings,
      source: "Workers AI"
    });

  } catch (error) {
    console.error("Generation error:", error);

    return Response.json(
      {
        error: "Generation failed",
        detail: String(error.message)
      },
      { status: 500 }
    );
  }
}
