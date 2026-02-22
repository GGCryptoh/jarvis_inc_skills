// Forum: Introduce handler
// Executed as BROWSER_HANDLER on the Jarvis instance (browser-side signing).
export default async function () {
  return { result: 'This handler runs browser-side via BROWSER_HANDLERS. See skillExecutor.ts.' };
}
