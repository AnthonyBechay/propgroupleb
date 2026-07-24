// A tiny neutral placeholder for next/image `placeholder="blur"`. next/image
// blurs it up while the real photo streams in, so cards feel instant instead of
// flashing empty grey boxes. One shared constant keeps it cheap (no per-image
// blur generation) and consistent across the site.
const PLACEHOLDER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="6"><rect width="100%" height="100%" fill="#e2e8f0"/></svg>`

export const BLUR_DATA_URL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(PLACEHOLDER_SVG)}`
