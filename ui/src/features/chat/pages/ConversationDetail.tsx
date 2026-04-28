import type { Agent, IssueComment } from "@paperclipai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, MessageSquare, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate, useParams } from "@/lib/router";
import { agentsApi } from "../../../api/agents";
import { heartbeatsApi } from "../../../api/heartbeats";
import { issuesApi } from "../../../api/issues";
import { EmptyState } from "../../../components/EmptyState";
import { MarkdownBody } from "../../../components/MarkdownBody";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { useBreadcrumbs } from "../../../context/BreadcrumbContext";
import { useCompany } from "../../../context/CompanyContext";
import { queryKeys } from "../../../lib/queryKeys";

export function ConversationDetail() {
  const { issueId } = useParams<{ issueId: string }>();
  const navigate = useNavigate();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: issue, isLoading: issueLoading } = useQuery({
    queryKey: ["conversation-issue", issueId],
    queryFn: () => issuesApi.get(issueId!),
    enabled: !!issueId,
  });

  useEffect(() => {
    if (!issue) return;
    if (issue.originKind !== "conversation") {
      navigate(`/issues/${issue.identifier ?? issue.id}`, { replace: true });
      return;
    }
    setBreadcrumbs([
      { label: "Chat", href: "/chat" },
      { label: issue.title || "Conversation" },
    ]);
  }, [issue, navigate, setBreadcrumbs]);

  const enableThreadQueries =
    !!issueId && !!issue && issue.originKind === "conversation";

  const commentsQueryKey = ["conversation-comments", issueId] as const;
  const activeRunQueryKey = ["conversation-active-run", issueId] as const;

  const { data: comments = [] } = useQuery<IssueComment[]>({
    queryKey: commentsQueryKey,
    queryFn: () =>
      issuesApi.listComments(issueId!, { order: "asc", limit: 200 }),
    enabled: enableThreadQueries,
    refetchInterval: 3000,
  });

  const { data: activeRun } = useQuery({
    queryKey: activeRunQueryKey,
    queryFn: () => heartbeatsApi.activeRunForIssue(issueId!),
    enabled: enableThreadQueries,
    refetchInterval: 2000,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentById = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((agent) => map.set(agent.id, agent));
    return map;
  }, [agents]);

  const addComment = useMutation({
    mutationFn: (body: string) => issuesApi.addComment(issueId!, body),
    onMutate: () => setInput(""),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      queryClient.invalidateQueries({ queryKey: activeRunQueryKey });
    },
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight });
  }, []);

  if (issueLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (!issue) {
    return (
      <EmptyState icon={MessageSquare} message="Conversation not found." />
    );
  }

  if (issue.originKind !== "conversation") {
    return null;
  }

  const assigneeAgent = issue.assigneeAgentId
    ? (agentById.get(issue.assigneeAgentId) ?? null)
    : null;
  const isRunning = !!activeRun && activeRun.status === "running";
  const sending = addComment.isPending;
  const composerDisabled = isRunning || sending;

  const handleSend = () => {
    const body = input.trim();
    if (!body || composerDisabled) return;
    addComment.mutate(body);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto w-full">
      <div className="flex items-start gap-3 px-4 py-3 border-b border-border">
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">
            {issue.title || "Untitled conversation"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
            <Bot className="h-3 w-3" />
            <span>{assigneeAgent?.name ?? "Unassigned"}</span>
            {isRunning && (
              <span className="inline-flex items-center gap-1 text-cyan-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Working...
              </span>
            )}
          </p>
        </div>
      </div>

      <ScrollArea
        className="flex-1 min-h-0"
        ref={scrollRef as unknown as React.Ref<HTMLDivElement>}
      >
        <div className="px-4 py-6 space-y-4">
          {comments.length === 0 && !isRunning && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <p className="font-medium">Start the conversation</p>
              <p className="mt-1 text-xs">
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
                className={`flex gap-3 ${fromAgent ? "" : "flex-row-reverse"}`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium ${
                    fromAgent
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {initial}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium bg-secondary text-secondary-foreground">
                {assigneeAgent?.name?.trim().charAt(0).toUpperCase() ?? "A"}
              </div>
              <div className="rounded-2xl px-4 py-2.5 text-sm bg-secondary/50 border border-border/50 flex items-center gap-2 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse opacity-60" />
                <span className="text-xs">
                  {assigneeAgent?.name ?? "Agent"} is thinking...
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border px-4 py-3">
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
              : "Type a message and press Enter..."
          }
          disabled={composerDisabled}
          rows={3}
          className="resize-none bg-background text-sm"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">
            Shift+Enter for newline
          </span>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim() || composerDisabled}
          >
            {sending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
