import type { Agent, Issue, IssueComment } from "@paperclipai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, List, Loader2, MessageSquare, Plus, Send, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLocation, useNavigate } from "@/lib/router";
import { agentsApi } from "../../../api/agents";
import { heartbeatsApi } from "../../../api/heartbeats";
import { issuesApi } from "../../../api/issues";
import { MarkdownBody } from "../../../components/MarkdownBody";
import { useCompany } from "../../../context/CompanyContext";
import { queryKeys } from "../../../lib/queryKeys";
import { createConversationPath, isInsideChatRoute } from "../routes";
import { StartConversationDialog } from "./StartConversationDialog";

const FLOATING_CONVERSATIONS_KEY = "floating-chat-conversations";
const FLOATING_COMMENTS_KEY = "floating-chat-comments";
const FLOATING_ACTIVE_RUN_KEY = "floating-chat-active-run";

type PanelMode = "chat" | "list";

export function FloatingChatButton() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [panelOpen, setPanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<PanelMode>("chat");
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const hiddenRoute = isInsideChatRoute(location.pathname);
  const companyId = selectedCompanyId;

  const conversationsKey = [FLOATING_CONVERSATIONS_KEY, companyId] as const;

  const { data: conversations = [] } = useQuery<Issue[]>({
    queryKey: conversationsKey,
    queryFn: () =>
      issuesApi.list(companyId!, {
        originKind: "conversation",
        excludeConversations: false,
        limit: 20,
      }),
    enabled: !!companyId && panelOpen,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: queryKeys.agents.list(companyId!),
    queryFn: () => agentsApi.list(companyId!),
    enabled: !!companyId && (panelOpen || dialogOpen),
  });

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((agent) => map.set(agent.id, agent));
    return map;
  }, [agents]);

  useEffect(() => {
    if (!panelOpen) return;
    if (activeConversationId) return;
    if (conversations.length === 0) {
      setMode("list");
      return;
    }
    setActiveConversationId(conversations[0]?.id);
    setMode("chat");
  }, [panelOpen, conversations, activeConversationId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const commentsKey = [FLOATING_COMMENTS_KEY, activeConversationId] as const;
  const activeRunKey = [FLOATING_ACTIVE_RUN_KEY, activeConversationId] as const;

  const { data: comments = [] } = useQuery<IssueComment[]>({
    queryKey: commentsKey,
    queryFn: () =>
      issuesApi.listComments(activeConversationId!, {
        order: "asc",
        limit: 200,
      }),
    enabled: panelOpen && !!activeConversationId && mode === "chat",
    refetchInterval: 3000,
  });

  const { data: activeRun } = useQuery({
    queryKey: activeRunKey,
    queryFn: () => heartbeatsApi.activeRunForIssue(activeConversationId!),
    enabled: panelOpen && !!activeConversationId && mode === "chat",
    refetchInterval: 2000,
  });

  const createConversation = useMutation({
    mutationFn: ({ agentId, title }: { agentId: string; title: string }) =>
      issuesApi.create(companyId!, {
        originKind: "conversation",
        assigneeAgentId: agentId,
        title,
        status: "todo",
        priority: "medium",
      }),
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      setDialogOpen(false);
      setActiveConversationId(issue.id);
      setMode("chat");
    },
  });

  const addComment = useMutation({
    mutationFn: (body: string) =>
      issuesApi.addComment(activeConversationId!, body),
    onMutate: () => setInput(""),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey });
      queryClient.invalidateQueries({ queryKey: activeRunKey });
    },
  });

  useEffect(() => {
    if (!panelOpen || mode !== "chat") return;
    const node = scrollRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [panelOpen, mode]);

  if (hiddenRoute || !companyId) {
    return null;
  }

  const assigneeAgent = activeConversation?.assigneeAgentId
    ? (agentById.get(activeConversation.assigneeAgentId) ?? null)
    : null;
  const isRunning = !!activeRun && activeRun.status === "running";
  const sending = addComment.isPending;
  const composerDisabled = !activeConversationId || isRunning || sending;

  const handleSend = () => {
    const body = input.trim();
    if (!body || composerDisabled) return;
    addComment.mutate(body);
  };

  const openPanel = () => {
    setPanelOpen(true);
  };
  const closePanel = () => {
    setPanelOpen(false);
  };
  const selectConversation = (id: string) => {
    setActiveConversationId(id);
    setMode("chat");
  };
  const backToList = () => {
    setMode("list");
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          aria-label={panelOpen ? "Close chat" : "Open chat"}
          onClick={panelOpen ? closePanel : openPanel}
          className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center"
        >
          {panelOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageSquare className="h-6 w-6" />
          )}
        </button>
      </div>

      {panelOpen && (
        <div
          role="dialog"
          aria-label="Chat panel"
          className="fixed bottom-24 right-6 z-40 w-[min(420px,calc(100vw-3rem))] h-[min(600px,calc(100vh-8rem))] bg-popover text-popover-foreground rounded-2xl border border-border shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            {mode === "chat" && activeConversation ? (
              <>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0"
                  aria-label="Back to conversations"
                  onClick={backToList}
                >
                  <List className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">
                    {activeConversation.title || "Untitled"}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                    <Bot className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {assigneeAgent?.name ?? "Unassigned"}
                    </span>
                    {isRunning && (
                      <span className="inline-flex items-center gap-0.5 text-cyan-500 ml-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Working...
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="text-sm font-semibold flex-1">Chat</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  New
                </Button>
              </>
            )}
          </div>

          {mode === "chat" && activeConversationId ? (
            <>
              <div
                ref={scrollRef}
                className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3"
              >
                {comments.length === 0 && !isRunning && (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    <p className="font-medium">Start the conversation</p>
                    <p className="mt-1">
                      Your first message will wake{" "}
                      {assigneeAgent?.name ?? "the agent"}.
                    </p>
                  </div>
                )}
                {comments.map((comment) => {
                  const fromAgent = !!comment.authorAgentId;
                  const authorName = fromAgent
                    ? (agentById.get(comment.authorAgentId!)?.name ?? "Agent")
                    : "You";
                  const initial =
                    authorName.trim().charAt(0).toUpperCase() ||
                    (fromAgent ? "A" : "Y");
                  return (
                    <div
                      key={comment.id}
                      className={`flex gap-2 ${fromAgent ? "" : "flex-row-reverse"}`}
                    >
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                          fromAgent
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        {initial}
                      </div>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                          fromAgent
                            ? "bg-secondary text-secondary-foreground border border-border/50"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        <MarkdownBody>{comment.body || ""}</MarkdownBody>
                      </div>
                    </div>
                  );
                })}
                {isRunning && (
                  <div className="flex gap-2">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium bg-secondary text-secondary-foreground">
                      {assigneeAgent?.name?.trim().charAt(0).toUpperCase() ??
                        "A"}
                    </div>
                    <div className="rounded-2xl px-3 py-2 text-xs bg-secondary/50 border border-border/50 flex items-center gap-2 text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse opacity-60" />
                      <span>
                        {assigneeAgent?.name ?? "Agent"} is thinking...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-3 py-2 shrink-0">
                <Textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={
                    isRunning
                      ? "Agent is running — please wait..."
                      : "Type a message..."
                  }
                  disabled={composerDisabled}
                  rows={2}
                  className="resize-none bg-background text-xs"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeConversation) {
                        navigate(
                          createConversationPath(
                            activeConversation.identifier ??
                              activeConversation.id,
                          ),
                        );
                        closePanel();
                      }
                    }}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Open full page
                  </button>
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!input.trim() || composerDisabled}
                    className="h-7 gap-1 text-xs"
                  >
                    {sending ? (
                      "Sending..."
                    ) : (
                      <>
                        <Send className="h-3 w-3" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="font-medium">No conversations yet</p>
                  <Button
                    size="sm"
                    variant="link"
                    className="mt-1 h-auto p-0 text-xs"
                    onClick={() => setDialogOpen(true)}
                  >
                    Start your first chat
                  </Button>
                </div>
              ) : (
                <ul className="flex flex-col">
                  {conversations.map((conv) => {
                    const agentName = conv.assigneeAgentId
                      ? (agentById.get(conv.assigneeAgentId)?.name ??
                        "Unassigned")
                      : "Unassigned";
                    return (
                      <li key={conv.id}>
                        <button
                          type="button"
                          onClick={() => selectConversation(conv.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/50 transition-colors text-left border-b border-border/50 last:border-b-0"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">
                              {conv.title || "Untitled"}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {agentName}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {mode === "list" && conversations.length > 0 && (
            <div className="border-t border-border px-3 py-2 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="w-full h-7 text-xs"
                onClick={() => {
                  closePanel();
                  navigate("/chat");
                }}
              >
                Open full Chat page
              </Button>
            </div>
          )}
        </div>
      )}

      <StartConversationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        agents={agents}
        onStart={({ agentId, title }) =>
          createConversation.mutate({ agentId, title })
        }
        isCreating={createConversation.isPending}
      />
    </>
  );
}
