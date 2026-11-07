
const AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

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
    const style = String(
      body.playStyle || body.style || "balanced"
    );
    const scale = Number(body.scale) === 100 ? 100 : 200;

    if (!brand.trim() || !model.trim()) {
      return Response.json(
        { error: "Phone brand and model required" },
        { status: 400 }
      );
    }

    const prompt = `
Recommend Free Fire sensitivity settings.

Phone brand: ${brand}
Phone model: ${model}
RAM: ${ram} GB
Refresh rate: ${hz} Hz
Play style: ${style}
Sensitivity scale: 0-${scale}

Consider the phone model and hardware details
when estimating the settings.

Return ONLY a valid JSON object with these keys:
general, redDot, scope2x, scope4x,
sniperScope, freeLook, fireButtonSize, dpi.

Sensitivity values must be between 0 and ${scale}.
Fire button size must be between 20 and 70.
DPI must be between 300 and 650.

These are estimated starting settings, not
verified sensitivity values for this phone.
`;

    const response = await env.AI.run(AI_MODEL, {
      messages: [
        {
          role: "system",
          content:
            "You generate estimated Free Fire settings. " +
            "Return only valid JSON with numeric values. " +
            "No markdown or explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.2
    });

    const raw =
      typeof response.response === "string"
        ? response.response
        : JSON.stringify(response);

    const match = raw.match(/\{[\s\S]*?\}/);

    if (!match) {
      throw new Error("AI returned no JSON");
    }

    const parsed = JSON.parse(match[0]);

    const keys = [
      "general",
      "redDot",
      "scope2x",
      "scope4x",
      "sniperScope",
      "freeLook",
      "fireButtonSize",
      "dpi"
    ];

    const settings = {};

    for (const key of keys) {
      const value = Number(parsed[key]);

      if (!Number.isFinite(value) || parsed[key] == null) {
        throw new Error("Invalid AI value: " + key);
      }

      const min =
        key === "dpi" ? 300 :
        key === "fireButtonSize" ? 20 : 0;

      const max =
        key === "dpi" ? 650 :
        key === "fireButtonSize" ? 70 : scale;

      settings[key] = Math.round(
        Math.max(min, Math.min(max, value))
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
