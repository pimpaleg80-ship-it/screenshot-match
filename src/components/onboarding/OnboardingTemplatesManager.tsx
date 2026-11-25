import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Layers,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  OnboardingTemplate,
  OnboardingChecklistItem,
  getTaskCategoryBadge,
} from "@/lib/onboarding";

export function OnboardingTemplatesManager() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["onboarding-templates-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_templates")
        .select("*")
        .order("is_default", { ascending: false });

      if (error) {
        console.warn("Could not load templates:", error.message);
        return [];
      }
      return (data ?? []) as OnboardingTemplate[];
    },
  });

  // Default to first template if none selected
  const activeTemplateId = selectedTemplateId || (templates[0]?.id ?? null);
  const activeTemplate = templates.find((t) => t.id === activeTemplateId);

  // Fetch checklist items for selected template
  const { data: checklistItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ["onboarding-checklist-items", activeTemplateId],
    enabled: Boolean(activeTemplateId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_checklist_items")
        .select("*")
        .eq("template_id", activeTemplateId!)
        .order("order_index", { ascending: true });

      if (error) {
        console.warn("Could not load items:", error.message);
        return [];
      }
      return (data ?? []) as OnboardingChecklistItem[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Onboarding Checklist Templates</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure standardized joining workflows, required document categories, and orientation tasks.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template List sidebar */}
        <div className="space-y-3">
          {templates.map((tpl) => (
            <Card
              key={tpl.id}
              className={`p-4 cursor-pointer transition border-2 ${
                tpl.id === activeTemplateId
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "hover:border-border/80 bg-card"
              }`}
              onClick={() => setSelectedTemplateId(tpl.id)}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground">
                    {tpl.name}
                  </h4>
                  {tpl.is_default && (
                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                      Default
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {tpl.description || "Preconfigured onboarding checklist for new personnel."}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Checklist items view */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="p-4 sm:p-5 pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {activeTemplate?.name || "Template Items"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Tasks automatically assigned when onboarding a candidate with this template.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs font-mono">
                  {checklistItems.length} Tasks
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loadingItems ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading template checklist items...
                </div>
              ) : checklistItems.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
                  <Layers className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p>No checklist items found in this template.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-12 text-center">#</TableHead>
                        <TableHead>Task Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead>Document Attached</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {checklistItems.map((item, idx) => {
                        const catBadge = getTaskCategoryBadge(item.category);

                        return (
                          <TableRow key={item.id} className="hover:bg-muted/30">
                            <TableCell className="text-center text-xs font-mono text-muted-foreground">
                              {idx + 1}
                            </TableCell>

                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="font-semibold text-xs sm:text-sm text-foreground">
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline" className={catBadge.colorClass + " text-[10px]"}>
                                {catBadge.label}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {item.required ? (
                                <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 bg-rose-500/10">
                                  Mandatory
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  Optional
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              {item.document_category ? (
                                <span className="font-mono text-[11px] text-foreground bg-muted px-1.5 py-0.5 rounded">
                                  {item.document_category}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
