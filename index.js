const HOMEPAGE_URL = "https://slovyagin.com";
const LOCAL_DEV_URL = "http://localhost:4321";
const CLOUD_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image`;
const ALLOWED_REFERERS = [
  HOMEPAGE_URL,
  `${HOMEPAGE_URL}/`,
  LOCAL_DEV_URL,
  `${LOCAL_DEV_URL}/`
];

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

function parseCustomUrl(url) {
  const pathname = url.pathname.substring(1); // Remove leading slash
  const [imageName] = pathname.split(".");
  const params = new URLSearchParams(url.search);

  let transformations = "c_fit,q_auto";
  if (params.has("w")) transformations += `,w_${params.get("w")}`;
  if (params.has("h")) transformations += `,h_${params.get("h")}`;

  // Remove w and h from params as we've handled them
  params.delete("w");
  params.delete("h");

  const cloudinaryPath = `upload/${transformations}/v1/photos/${imageName}`;
  const remainingParams = params.toString();

  return { cloudinaryPath, remainingParams };
}

async function serveAsset(event) {
  const url = new URL(event.request.url);
  const cache = caches.default;
  let response = await cache.match(event.request);

  if (!response) {
    const { cloudinaryPath, remainingParams } = parseCustomUrl(url);
    const cloudinaryURL = `${CLOUD_URL}/${cloudinaryPath}.avif${
      remainingParams ? "?" + remainingParams : ""
    }`;

    response = await fetch(cloudinaryURL, {
      headers: {
        ...event.request.headers,
        "User-Agent": "Cloudflare Worker"
      }
    });

    const headers = new Headers(response.headers);
    headers.set("cache-control", `public, max-age=${30 * 24 * 60 * 60}`);
    headers.set("vary", "Accept, Referer");
    response = new Response(response.body, { ...response, headers });
    event.waitUntil(cache.put(event.request, response.clone()));
  }

  return response;
}

function checkReferer(request) {
  const referer = request.headers.get("Referer");
  
  return (
    referer && ALLOWED_REFERERS.some(allowed => referer.startsWith(allowed))
  );
}

async function handleRequest(event) {
  const request = event.request;

  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!checkReferer(request)) {
    return new Response("Hotlinking not allowed", {
      status: 403,
      headers: { "Content-Type": "text/plain" }
    });
  }

  let response = await serveAsset(event);

  if (response.status > 399) {
    response = new Response(response.statusText, { status: response.status });
  }

  return response;
}
