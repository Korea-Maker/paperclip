import type { Issue } from "@paperclipai/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@/lib/router";
import { agentsApi } from "../../../api/agents";
import { issuesApi } from "../../../api/issues";
import { EmptyState } from "../../../components/EmptyState";
import { PageSkeleton } from "../../../components/PageSkeleton";
import { useBreadcrumbs } from "../../../context/BreadcrumbContext";
import { useCompany } from "../../../context/CompanyContext";
import { queryKeys } from "../../../lib/queryKeys";
import { StartConversationDialog } from "../components/StartConversationDialog";
import { createConversationPath } from "../routes";

const CONVERSATIONS_QUERY_KEY = "chat-conversations";

export function Chat() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Chat" }]);
  }, [setBreadcrumbs]);

  const conversationsKey = [
    CONVERSATIONS_QUERY_KEY,
    selectedCompanyId,
  ] as const;

  const { data: conversations, isLoading } = useQuery({
    queryKey: conversationsKey,
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        originKind: "conversation",
        excludeConversations: false,
        limit: 200,
      }),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentNameById = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.id, agent.name));
    return map;
  }, [agents]);

  const createConversation = useMutation({
    mutationFn: ({ agentId, title }: { agentId: string; title: string }) =>
      issuesApi.create(selectedCompanyId!, {
        originKind: "conversation",
        assigneeAgentId: agentId,
        title,
        status: "todo",
        priority: "medium",
      }),
    onSuccess: (issue: Issue) => {
      queryClient.invalidateQueries({ queryKey: conversationsKey });
      setStartOpen(false);
      navigate(createConversationPath(issue.identifier ?? issue.id));
    },
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={MessageSquare}
        message="Select a company to start chatting."
      />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const sortedConversations = [...(conversations ?? [])].sort((a, b) => {
    const aTime = new Date(a.completedAt ?? a.startedAt ?? 0).getTime();
    const bTime = new Date(b.completedAt ?? b.startedAt ?? 0).getTime();
    return bTime - aTime;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Chat</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            1:1 conversations with your agents. Lightweight alternative to
            opening an issue.
          </p>
        </div>
        <Button size="sm" onClick={() => setStartOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New conversation
        </Button>
      </div>

      {sortedConversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          message="No conversations yet. Start one to brainstorm or consult an agent without opening a full issue."
          action="Start your first chat"
          onAction={() => setStartOpen(true)}
        />
      ) : (
        <ul className="flex flex-col border border-border rounded-lg overflow-hidden bg-background">
          {sortedConversations.map((conv) => {
            const agentLabel = conv.assigneeAgentId
              ? (agentNameById.get(conv.assigneeAgentId) ?? "Unassigned agent")
              : "Unassigned";
            return (
              <li key={conv.id}>
                <button
                  type="button"
                  onClick={() =>
                    navigate(createConversationPath(conv.identifier ?? conv.id))
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-accent/40 transition-colors text-left"
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {conv.title || "Untitled conversation"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {agentLabel}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <StartConversationDialog
        open={startOpen}
        onOpenChange={setStartOpen}
        agents={agents ?? []}
        onStart={({ agentId, title }) =>
          createConversation.mutate({ agentId, title })
        }
        isCreating={createConversation.isPending}
      />
    </div>
  );
}
