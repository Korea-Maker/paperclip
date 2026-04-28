export const CHAT_ROUTE_ROOT = "chat";

export function createConversationPath(issuePathId: string): string {
  return `/${CHAT_ROUTE_ROOT}/${issuePathId}`;
}

export function isInsideChatRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length >= 2 && segments[1]?.toLowerCase() === CHAT_ROUTE_ROOT;
}
