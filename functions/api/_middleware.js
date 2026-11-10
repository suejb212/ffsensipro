export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === "ffsensipro.pages.dev") {
    const destination = new URL(
      url.pathname + url.search,
      "https://ffsensipro.com"
    );

    return Response.redirect(destination.toString(), 301);
  }

  return context.next();
}
