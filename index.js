const CLOUD_NAME = "slovyagin";
const CLOUD_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image`;

class InvalidSizeError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidSizeError";
  }
}

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

function parseCustomUrl(url) {
  const pathname = url.pathname.substring(1);
  const [imageName] = pathname.split(".");
  const params = new URLSearchParams(url.search);
  let transformations = "c_fit,q_auto";

  if (params.has("s")) {
    const size = params.get("s");
    const allowedSizes = ["700", "900", "1400"];
    
    if (!allowedSizes.includes(size)) {
      throw new InvalidSizeError("Invalid size parameter");
    }
    
    transformations += `,w_${size},h_${size}`;
  }

  params.delete("s");

  const cloudinaryPath = `upload/${transformations}/v1/photos/${imageName}`;
  const remainingParams = params.toString();

  return { cloudinaryPath, remainingParams };
}

async function serveAsset(event) {
  const url = new URL(event.request.url);
  const cache = caches.default;
  
  try {
    // Attempt to parse the URL regardless of cache status
    parseCustomUrl(url);
  } catch (error) {
    if (error instanceof InvalidSizeError) {
      return new Response("Unprocessable Entity", { status: 422 });
    }
    throw error;
  }

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
    headers.set("cache-control", `public, max-age=${365 * 24 * 60 * 60}`);
    headers.set("vary", "Accept, Referer");

    response = new Response(response.body, { ...response, headers });
    event.waitUntil(cache.put(event.request, response.clone()));
  }

  return response;
}

async function handleRequest(event) {
  const request = event.request;
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    let response = await serveAsset(event);
    if (response.status > 399) {
      response = new Response(response.statusText, { status: response.status });
    }
    return response;
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
