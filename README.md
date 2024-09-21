# Cloudflare Workers × Cloudinary Cache + Proxy

This project allows you to:

1. Add a custom domain to your Cloudinary account
2. Cache your images to reduce Cloudinary bandwidth usage
3. Prevent hotlinking and restrict image access to your domain

While designed for Cloudinary, this should work for any CDN. For instance, you can proxy Backblaze B2 files with Cloudflare. The bandwidth between the two is free, so you're only paying Backblaze for asset storage.

## New Features

- **Hotlinking Prevention**: Images can only be accessed from your specified domain(s).
- **Improved Caching**: Caching headers have been optimized for better performance.
- **Custom User-Agent**: Requests to Cloudinary now use a custom User-Agent for better tracking.

## Setup

1. Rename `wrangler.toml.example` to `wrangler.toml`
2. In `wrangler.toml`, fill in the Account ID and Zone ID found on your Cloudflare domain name main page.
3. Fill in your Cloudinary cloud name in the environmental variables in `wrangler.toml`
4. In Cloudflare, add a sub-domain DNS Record for your images, e.g., `images.yourdomain.com`. Set this to type: `AAAA`, name: `images`, content: `100::`
5. Change `route = "images.yourdomain.com/*"` in `wrangler.toml` to match your domain.
6. Update the `HOMEPAGE_URL` and `ALLOWED_REFERERS` in the Worker script to match your domain.
7. Deploy with:
   * `wrangler publish` to test on `workers.dev`
   * `wrangler publish --env production` to deploy to your custom domain

If you haven't already, install Wrangler globally with `npm i @cloudflare/wrangler -g` (don't use sudo). Log in with `wrangler login`.

## Usage

Replace the `res.cloudinary.com/CLOUDNAME/image` part of your Cloudinary URLs with `images.yourdomain.com`.

Example:
Original: `https://res.cloudinary.com/wesbos/image/upload/v1612297289/ARG-poster_cexeys.jpg`
New: `https://images.wesbos.com/upload/v1612297289/ARG-poster_cexeys.jpg`

This should work with all fetching methods and URL transforms.

## Verifying Caching and Security

- Check for `cf-cache-status HIT` in the response headers (in dev tools network tab) to confirm caching. This appears on subsequent requests.
- Attempts to hotlink images from non-allowed domains will receive a 403 Forbidden response.

## Customization

- Adjust the `ALLOWED_REFERERS` array in the Worker script to control which domains can access your images.
- Modify the cache duration by changing the `max-age` value in the `cache-control` header.

## Troubleshooting

- If images aren't loading, check the browser console for error messages.
- Verify that your `ALLOWED_REFERERS` includes all necessary domains and subdomains.
- Ensure your Cloudinary cloud name is correctly set in the environmental variables.

## Future Enhancements

- Rate limiting to prevent abuse
- Dynamic allowed referers list using Cloudflare KV
- Support for custom image transformations

## License

[MIT License](LICENSE)