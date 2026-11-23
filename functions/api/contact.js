const DESTINATION_EMAIL = "sensiff282@gmail.com";

export async function onRequestPost(context) {
  const { request, env } = context;

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });

  try {
    if (!env.BREVO_API_KEY) {
      return json({
        success: false,
        error: "Email service is not configured."
      }, 503);
    }

    const contentType =
      request.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return json({
        success: false,
        error: "Invalid request format."
      }, 415);
    }

    const raw = await request.text();

    if (raw.length > 12000) {
      return json({
        success: false,
        error: "Message is too large."
      }, 413);
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      return json({
        success: false,
        error: "Invalid message data."
      }, 400);
    }

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim();
    const subject = String(data.subject || "").trim();
    const message = String(data.message || "").trim();

    const allowedSubjects = [
      "Free Sensi Generator",
      "Premium Sensi",
      "Payment Issue",
      "Website Problem",
      "Suggestion or Feedback",
      "Privacy Request",
      "Other"
    ];

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !name ||
      name.length > 100 ||
      !emailPattern.test(email) ||
      email.length > 254 ||
      !allowedSubjects.includes(subject) ||
      message.length < 10 ||
      message.length > 3000
    ) {
      return json({
        success: false,
        error: "Please check your form details."
      }, 400);
    }

    const escapeHtml = (value) =>
      value.replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message)
      .replace(/\n/g, "<br>");

    const senderEmail = env.BREVO_SENDER_EMAIL;

    if (!senderEmail) {
      return json({
        success: false,
        error: "Sender email is not configured."
      }, 503);
    }

    const brevoResponse = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: {
            name: "FF Sensi Pro",
            email: senderEmail
          },
          to: [
            {
              email: DESTINATION_EMAIL,
              name: "FF Sensi Pro Support"
            }
          ],
          replyTo: {
            email,
            name
          },
          subject: "FF Sensi Pro Contact: " + subject,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;
                        max-width:600px;margin:auto;
                        color:#172033">
              <h2 style="color:#087c9a">
                New FF Sensi Pro Message
              </h2>
              <p><strong>Name:</strong> ${safeName}</p>
              <p><strong>Email:</strong> ${safeEmail}</p>
              <p><strong>Topic:</strong> ${safeSubject}</p>
              <hr>
              <h3>Message</h3>
              <p>${safeMessage}</p>
              <hr>
              <p style="font-size:12px;color:#777">
                Sent from ffsensipro.com/contact.html
              </p>
            </div>
          `,
          textContent:
            "New FF Sensi Pro Message\n\n" +
            "Name: " + name + "\n" +
            "Email: " + email + "\n" +
            "Topic: " + subject + "\n\n" +
            "Message:\n" + message
        })
      }
    );

    if (!brevoResponse.ok) {
  const brevoError = await brevoResponse.text();

  console.error(
    "Brevo email request failed:",
    brevoResponse.status,
    brevoError
  );

      return json({
        success: false,
        error: "Unable to send your message. Please try again later."
      }, 502);
    }

    return json({
      success: true
    });

  } catch (error) {
    console.error("Contact form error:", error.message);

    return json({
      success: false,
      error: "Something went wrong. Please try again."
    }, 500);
  }
}

export function onRequestGet() {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      "Allow": "POST"
    }
  });
}
