// Cloudinary account name for image storage
const CLOUD_NAME = "slovyagin";
// Base URL for Cloudinary image API
const CLOUD_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image`;

/**
 * Custom error class for handling invalid size parameters
 * Helps with clear error identification and specific error responses
 */
class InvalidSizeError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidSizeError";
  }
}

// Register event listener for all incoming HTTP requests
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

/**
 * Parses custom URL format and converts it to Cloudinary format with transformations
 *
 * @param {URL} url - The URL object to parse
 * @returns {Object} Object containing cloudinaryPath and remainingParams
 * @throws {InvalidSizeError} When size parameter is missing or invalid
 */
function parseCustomUrl(url) {
  const pathname = url.pathname.substring(1);
  const [imageName] = pathname.split(".");
  const params = new URLSearchParams(url.search);
  // Set default image transformations - content fit and auto quality
  let transformations = "c_fit,q_auto";

  // SECURITY CHECK: Require the size parameter to be present
  // This prevents direct access to original images without size restrictions
  if (!params.has("s")) {
    throw new InvalidSizeError("Size parameter is required");
  }

  const size = params.get("s");
  // Whitelist of allowed sizes to prevent arbitrary resizing
  const allowedSizes = ["700", "900", "1400"];

  // Validate that the requested size is in our allowed list
  // This prevents arbitrary resizing which could lead to high resource usage
  if (!allowedSizes.includes(size)) {
    throw new InvalidSizeError("Invalid size parameter");
  }

  // Add width and height constraints to the transformation string
  transformations += `,w_${size},h_${size}`;

  // Remove the size parameter as we've already processed it
  params.delete("s");

  // Construct the final Cloudinary path with transformations
  const cloudinaryPath = `upload/${transformations}/v1/photos/${imageName}`;
  const remainingParams = params.toString();

  return { cloudinaryPath, remainingParams };
}

/**
 * Serves image assets with caching
 * Uses Cloudinary for image transformations and Cloudflare for edge caching
 *
 * @param {FetchEvent} event - The fetch event containing the request
 * @returns {Response} HTTP response with the image or error
 */
async function serveAsset(event) {
  const url = new URL(event.request.url);
  // Get default Cloudflare cache
  const cache = caches.default;

  try {
    // Validate URL format before proceeding - this will also check for required size param
    parseCustomUrl(url);
  } catch (error) {
    // Return a specific error for invalid size parameters
    if (error instanceof InvalidSizeError) {
      return new Response("Unprocessable Entity", { status: 422 });
    }
    // Re-throw other errors to be caught by the main handler
    throw error;
  }

  // Check if the response is already in cache
  let response = await cache.match(event.request);

  if (!response) {
    // Not in cache, generate Cloudinary URL and fetch from origin
    const { cloudinaryPath, remainingParams } = parseCustomUrl(url);
    // Always use AVIF format for better compression
    const cloudinaryURL = `${CLOUD_URL}/${cloudinaryPath}.avif${
      remainingParams ? "?" + remainingParams : ""
    }`;

    // Fetch the image from Cloudinary
    response = await fetch(cloudinaryURL, {
      headers: {
        ...event.request.headers,
        "User-Agent": "Cloudflare Worker" // Identify our worker to Cloudinary
      }
    });

    // Set caching headers for better performance
    const headers = new Headers(response.headers);
    // Cache for 1 year (in seconds)
    headers.set("cache-control", `public, max-age=${365 * 24 * 60 * 60}`);
    // Vary header ensures proper cache variations based on Accept header and Referer
    headers.set("vary", "Accept, Referer");

    // Create new response with updated headers
    response = new Response(response.body, { ...response, headers });

    // Store in cache asynchronously (doesn't block the response)
    event.waitUntil(cache.put(event.request, response.clone()));
  }

  return response;
}

/**
 * Main request handler function
 * Validates request method and delegates to serveAsset
 *
 * @param {FetchEvent} event - The fetch event containing the request
 * @returns {Response} HTTP response with the image or error
 */
async function handleRequest(event) {
  const request = event.request;
  // Only allow GET requests for images
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    let response = await serveAsset(event);
    // Standardize error responses
    if (response.status > 399) {
      response = new Response(response.statusText, { status: response.status });
    }
    return response;
  } catch (error) {
    // Log unexpected errors and return a generic 500 response
    console.error("Unexpected error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
