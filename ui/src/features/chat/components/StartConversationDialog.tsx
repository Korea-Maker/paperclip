import type { Agent } from "@paperclipai/shared";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface StartConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  onStart: (params: { agentId: string; title: string }) => void;
  isCreating: boolean;
  defaultAgentId?: string | null;
}

export function StartConversationDialog({
  open,
  onOpenChange,
  agents,
  onStart,
  isCreating,
  defaultAgentId,
}: StartConversationDialogProps) {
  const activeAgents = useMemo(
    () => agents.filter((agent) => agent.status !== "terminated"),
    [agents],
  );

  const [agentId, setAgentId] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
    const fallback = defaultAgentId ?? activeAgents[0]?.id ?? "";
    setAgentId(fallback);
  }, [open, defaultAgentId, activeAgents]);

  const canSubmit = agentId.trim().length > 0 && !isCreating;

  function handleSubmit() {
    if (!canSubmit) return;
    const trimmedTitle = title.trim();
    onStart({
      agentId,
      title: trimmedTitle.length > 0 ? trimmedTitle : "New conversation",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a conversation</DialogTitle>
          <DialogDescription>
            Chat 1:1 with an agent. The agent's adapter, effort, and other
            settings apply automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="conversation-agent">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger id="conversation-agent">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    No agents available
                  </SelectItem>
                ) : (
                  activeAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conversation-title">Topic (optional)</Label>
            <Input
              id="conversation-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q2 pricing brainstorm"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isCreating ? "Starting..." : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
