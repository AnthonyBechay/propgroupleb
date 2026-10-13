/**
 * Serialise a JSON-LD graph for embedding in a <script type="application/ld+json">.
 *
 * `JSON.stringify` escapes quotes and backslashes but NOT `<`, so a value
 * containing `</script>` closes the tag and everything after it is parsed as
 * HTML. The values that reach these graphs - a listing headline, a building
 * title, a city - are free text an admin types, and a building's title can
 * originate from the public "list your property" form and reach the page as
 * soon as the submission is approved. The page is cached by ISR, so one
 * poisoned record would be served to every visitor until it was revalidated.
 */
export function jsonLdScript(graph: unknown): string {
  return JSON.stringify(graph).replace(/</g, '\\u003c')
}
