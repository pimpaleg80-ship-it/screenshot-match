import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lightbulb, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import {
  SuggestionCategory,
  SUGGESTION_CATEGORIES,
} from "@/lib/engagement";

interface SuggestionBoxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  employeeId: string;
  userId: string;
}

export function SuggestionBoxModal({
  open,
  onOpenChange,
  organizationId,
  employeeId,
  userId,
}: SuggestionBoxModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<SuggestionCategory>("Workplace Culture");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Suggestion title is required.");
      if (!description.trim()) throw new Error("Description is required.");

      const payload = {
        organization_id: organizationId,
        title: title.trim(),
        description: description.trim(),
        category,
        is_anonymous: isAnonymous,
        employee_id: isAnonymous ? null : employeeId,
        user_id: isAnonymous ? null : userId,
        status: "submitted" as const,
      };

      const { error } = await supabase.from("employee_suggestions").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-suggestions"] });
      toast.success(
        isAnonymous
          ? "Anonymous suggestion shared with leadership!"
          : "Idea submitted to the innovation box!"
      );
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setCategory("Workplace Culture");
      setIsAnonymous(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit suggestion.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Share an Idea or Suggestion
          </DialogTitle>
          <DialogDescription>
            Submit creative workplace improvements, operational tweaks, or culture suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="sug-title">Idea Title *</Label>
            <Input
              id="sug-title"
              placeholder="Enter suggestion title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="sug-category">Category</Label>
            <Select
              value={category}
              onValueChange={(val) => setCategory(val as SuggestionCategory)}
            >
              <SelectTrigger id="sug-category">
                <SelectValue placeholder="Select Category" />
              </SelectTrigger>
              <SelectContent>
                {SUGGESTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="sug-desc">Detailed Proposal *</Label>
            <Textarea
              id="sug-desc"
              rows={4}
              placeholder="Describe the problem, your proposed solution, and anticipated positive impact..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Anonymity toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
            <div className="space-y-0.5 pr-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-600" /> Submit Anonymously
              </Label>
              <p className="text-xs text-muted-foreground">
                Your name and profile will be completely hidden from all colleagues and administrators.
              </p>
            </div>
            <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending}
            className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Send className="h-4 w-4" />
            {submitMutation.isPending ? "Submitting..." : "Submit Idea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
