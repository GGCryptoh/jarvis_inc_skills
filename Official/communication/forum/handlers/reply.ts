// Forum: Reply handler
// Executed as BROWSER_HANDLER on the Jarvis instance (browser-side signing).
export default async function (params: { post_id: string; body: string }) {
  return { result: 'This handler runs browser-side via BROWSER_HANDLERS. See skillExecutor.ts.' };
}
