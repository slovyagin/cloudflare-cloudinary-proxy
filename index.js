const HOMEPAGE_URL = "https://slovyagin.com/";
const CLOUD_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image`;

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function serveAsset(event) {
  const url = new URL(event.request.url);
  const cache = caches.default;
  let response = await cache.match(event.request);

  if (!response) {
    const cloudinaryURL = `${CLOUD_URL}${url.pathname}`;
    
    response = await fetch(cloudinaryURL, { headers: event.request.headers });
    
    const headers = new Headers(response.headers);
    
    headers.set("cache-control", `public, max-age=${365 * 24 * 60 * 60}`); // Cache for however long, here is 1 year.
    headers.set("vary", "Accept");
    response = new Response(response.body, { ...response, headers });
    event.waitUntil(cache.put(event.request, response.clone()));
  }

  return response;
}

async function handleRequest(event) {
  if (event.request.method === "GET") {
    let response = await serveAsset(event);

    if (response.status > 399) {
      response = new Response(response.statusText, { status: response.status });
    }

    return response;
  }

  return new Response("Method not allowed", { status: 405 });
}
