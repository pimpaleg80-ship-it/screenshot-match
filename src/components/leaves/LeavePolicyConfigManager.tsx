import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Layers,
  Sparkles,
  Shield,
  Clock,
  ArrowRight,
  HelpCircle,
  Calendar,
  Save,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeaveType, LeavePolicy } from "@/lib/leave";

interface LeavePolicyConfigManagerProps {
  organizationId?: string | null;
}

export function LeavePolicyConfigManager({ organizationId }: LeavePolicyConfigManagerProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  // Create / Edit Leave Type Modal State
  const [createTypeModalOpen, setCreateTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);

  const [typeName, setTypeName] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [typeDays, setTypeDays] = useState("12");
  const [typeIsPaid, setTypeIsPaid] = useState(true);
  const [typeAllowHalfDay, setTypeAllowHalfDay] = useState(true);
  const [typeAllowCarryForward, setTypeAllowCarryForward] = useState(false);
  const [typeMaxCarryForward, setTypeMaxCarryForward] = useState("0");
  const [typeAllowEncashment, setTypeAllowEncashment] = useState(false);
  const [typeMaxEncashment, setTypeMaxEncashment] = useState("0");
  const [typeRequiresProof, setTypeRequiresProof] = useState(false);
  const [typeProofMinDays, setTypeProofMinDays] = useState("2");
  const [typeColor, setTypeColor] = useState("#3b82f6");
  const [typeDescription, setTypeDescription] = useState("");

  // Allocation Modal State
  const [allocationModalOpen, setAllocationModalOpen] = useState(false);
  const [allocationYear, setAllocationYear] = useState(String(currentYear));

  // Query Leave Types
  const { data: leaveTypes = [], isLoading: typesLoading } = useQuery({
    queryKey: ["all-leave-types-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_types")
        .select("*")
        .order("is_paid", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LeaveType[];
    },
  });

  // Query Corporate Policy
  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ["organization-leave-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_policies")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (error) throw error;
      return data as LeavePolicy | null;
    },
  });

  // Policy form state
  const [approvalFlow, setApprovalFlow] = useState<"manager_only" | "admin_only" | "manager_then_admin">(
    policy?.approval_flow || "manager_then_admin"
  );
  const [weeklyOffs, setWeeklyOffs] = useState<number[]>(policy?.weekly_off_days || [0, 6]);
  const [sandwichRule, setSandwichRule] = useState<boolean>(policy?.sandwich_rule_enabled || false);

  useEffect(() => {
    if (!policy) return;
    setApprovalFlow(policy.approval_flow || "manager_then_admin");
    setWeeklyOffs(policy.weekly_off_days || [0, 6]);
    setSandwichRule(Boolean(policy.sandwich_rule_enabled));
  }, [policy]);

  // Save Policy Mutation
  const savePolicyMutation = useMutation({
    mutationFn: async () => {
      if (policy?.id) {
        const { error } = await supabase
          .from("leave_policies")
          .update({
            approval_flow: approvalFlow,
            weekly_off_days: weeklyOffs,
            sandwich_rule_enabled: sandwichRule,
            updated_at: new Date().toISOString(),
          })
          .eq("id", policy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leave_policies").insert({
          ...(organizationId ? { organization_id: organizationId } : {}),
          name: "Standard Corporate Leave Policy",
          approval_flow: approvalFlow,
          weekly_off_days: weeklyOffs,
          sandwich_rule_enabled: sandwichRule,
          is_active: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Leave policy configuration updated");
      queryClient.invalidateQueries({ queryKey: ["organization-leave-policy"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update policy");
    },
  });

  // Save / Edit Leave Type Mutation
  const saveTypeMutation = useMutation({
    mutationFn: async () => {
      if (!typeName.trim()) throw new Error("Leave type name is required");
      const days = parseFloat(typeDays) || 0;

      const payload = {
        name: typeName.trim(),
        code: typeCode.trim().toUpperCase() || null,
        days_per_year: days,
        is_paid: typeIsPaid,
        allow_half_day: typeAllowHalfDay,
        allow_carry_forward: typeAllowCarryForward,
        max_carry_forward_days: typeAllowCarryForward ? parseInt(typeMaxCarryForward, 10) || 0 : 0,
        allow_encashment: typeAllowEncashment,
        max_encashment_days: typeAllowEncashment ? parseInt(typeMaxEncashment, 10) || 0 : 0,
        requires_document_proof: typeRequiresProof,
        document_proof_min_days: typeRequiresProof ? parseInt(typeProofMinDays, 10) || 2 : 2,
        color: typeColor,
        description: typeDescription.trim() || null,
        active: true,
      };

      if (editingType?.id) {
        const { error } = await supabase
          .from("leave_types")
          .update(payload)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("leave_types").insert({
          ...payload,
          ...(organizationId ? { organization_id: organizationId } : {}),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingType ? "Leave type updated" : "Custom leave type created");
      setCreateTypeModalOpen(false);
      setEditingType(null);
      queryClient.invalidateQueries({ queryKey: ["all-leave-types-config"] });
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save leave type");
    },
  });

  // Toggle Leave Type Active Mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("leave_types")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave type status updated");
      queryClient.invalidateQueries({ queryKey: ["all-leave-types-config"] });
    },
  });

  // Annual Balance Allocation Mutation
  const allocateMutation = useMutation({
    mutationFn: async () => {
      const year = parseInt(allocationYear, 10);
      const { data, error } = await supabase.rpc("allocate_annual_leaves", {
        p_year: year,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`Annual leave allocations generated for year ${allocationYear}`);
      setAllocationModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["my-leave-balances"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to generate allocations");
    },
  });

  function handleOpenCreate(lt?: LeaveType) {
    if (lt) {
      setEditingType(lt);
      setTypeName(lt.name);
      setTypeCode(lt.code || "");
      setTypeDays(String(lt.days_per_year));
      setTypeIsPaid(lt.is_paid);
      setTypeAllowHalfDay(lt.allow_half_day ?? true);
      setTypeAllowCarryForward(lt.allow_carry_forward ?? false);
      setTypeMaxCarryForward(String(lt.max_carry_forward_days ?? 0));
      setTypeAllowEncashment(lt.allow_encashment ?? false);
      setTypeMaxEncashment(String(lt.max_encashment_days ?? 0));
      setTypeRequiresProof(lt.requires_document_proof ?? false);
      setTypeProofMinDays(String(lt.document_proof_min_days ?? 2));
      setTypeColor(lt.color || "#3b82f6");
      setTypeDescription(lt.description || "");
    } else {
      setEditingType(null);
      setTypeName("");
      setTypeCode("");
      setTypeDays("10");
      setTypeIsPaid(true);
      setTypeAllowHalfDay(true);
      setTypeAllowCarryForward(false);
      setTypeMaxCarryForward("0");
      setTypeAllowEncashment(false);
      setTypeMaxEncashment("0");
      setTypeRequiresProof(false);
      setTypeProofMinDays("2");
      setTypeColor("#3b82f6");
      setTypeDescription("");
    }
    setCreateTypeModalOpen(true);
  }

  const daysOfWeek = [
    { num: 0, label: "Sunday" },
    { num: 1, label: "Monday" },
    { num: 2, label: "Tuesday" },
    { num: 3, label: "Wednesday" },
    { num: 4, label: "Thursday" },
    { num: 5, label: "Friday" },
    { num: 6, label: "Saturday" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Leave Policies & Categories</h3>
          <p className="text-xs text-muted-foreground">
            Configure multi-tier approval rules, carry-forward, custom categories, and annual allocation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => handleOpenCreate()}
            className="text-xs h-9 gap-1.5 bg-primary text-white"
          >
            <Plus className="h-4 w-4" />
            Add Leave Category
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setAllocationModalOpen(true)}
            className="text-xs h-9 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Run Annual Allocation
          </Button>
        </div>
      </div>

      {/* Grid: Corporate Policy Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> Corporate Leave Approval & Weekly Off Rules
          </CardTitle>
          <CardDescription className="text-xs">
            Standard workflow applied when employees apply for leave across the organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Approval Hierarchy */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Approval Hierarchy Flow</Label>
              <Select
                value={approvalFlow}
                onValueChange={(val: any) => setApprovalFlow(val)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager_then_admin">
                    2-Tier: Reporting Manager → HR Admin Final Approval
                  </SelectItem>
                  <SelectItem value="manager_only">
                    1-Tier: Reporting Manager Direct Approval (No HR Sign-off)
                  </SelectItem>
                  <SelectItem value="admin_only">
                    1-Tier: Centralized HR Admin Approval Only
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                In 2-Tier mode, the reporting manager inspects the absence before HR Admin commits the balance deduction.
              </p>
            </div>

            {/* Sandwich Rule Toggle */}
            <div className="space-y-2 border rounded-lg p-3 bg-muted/20 flex items-center justify-between">
              <div className="space-y-0.5 pr-2">
                <Label className="text-xs font-semibold">Sandwich Rule Enforcement</Label>
                <p className="text-[11px] text-muted-foreground">
                  If enabled, weekends and holidays falling between active leave dates count as deducted leaves.
                </p>
              </div>
              <Switch checked={sandwichRule} onCheckedChange={setSandwichRule} />
            </div>
          </div>

          {/* Weekly Off Days Selection */}
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold">Standard Weekly Off Days (Excluded from Leave Count)</Label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map((day) => {
                const isSelected = weeklyOffs.includes(day.num);
                return (
                  <Button
                    key={day.num}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (isSelected) {
                        setWeeklyOffs(weeklyOffs.filter((d) => d !== day.num));
                      } else {
                        setWeeklyOffs([...weeklyOffs, day.num]);
                      }
                    }}
                    className="text-xs h-8"
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => savePolicyMutation.mutate()}
              disabled={savePolicyMutation.isPending}
              className="text-xs h-9 gap-1.5"
            >
              {savePolicyMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Save className="h-4 w-4" />
              Save Policy Configuration
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leave Types Library */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Configured Leave Categories ({leaveTypes.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Manage entitlement days, encashment, carry-forward, and supporting documentation thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {typesLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leaveTypes.map((lt) => (
                <div
                  key={lt.id}
                  className={`rounded-lg border p-4 space-y-3 transition-all relative ${
                    lt.active ? "bg-card hover:border-primary/40 shadow-xs" : "bg-muted/20 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: lt.color || "#3b82f6" }}
                        />
                        <h4 className="font-bold text-sm text-foreground">{lt.name}</h4>
                        {lt.code && (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {lt.code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {lt.description || "Corporate absence category"}
                      </p>
                    </div>

                    <Badge
                      variant={lt.is_paid ? "default" : "secondary"}
                      className={`text-[10px] shrink-0 ${
                        lt.is_paid ? "bg-emerald-600 text-white" : ""
                      }`}
                    >
                      {lt.is_paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>

                  {/* Metrics Badge Row */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="rounded-lg bg-muted/40 p-2 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Entitlement</span>
                      <p className="font-bold text-sm text-foreground">{lt.days_per_year} days/yr</p>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">Carry-Forward</span>
                      <p className="font-bold text-sm text-foreground">
                        {lt.allow_carry_forward ? `Max ${lt.max_carry_forward_days}d` : "Disabled"}
                      </p>
                    </div>
                  </div>

                  {/* Rules Pill List */}
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    {lt.allow_half_day && (
                      <Badge variant="outline" className="text-[9px]">
                        Half-Day OK
                      </Badge>
                    )}
                    {lt.allow_encashment && (
                      <Badge variant="outline" className="text-[9px] text-emerald-600 border-emerald-300">
                        Encashable (max {lt.max_encashment_days}d)
                      </Badge>
                    )}
                    {lt.requires_document_proof && (
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                        Doc Proof &gt; {lt.document_proof_min_days}d
                      </Badge>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="pt-2 flex items-center justify-between border-t text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        toggleActiveMutation.mutate({ id: lt.id, active: !lt.active })
                      }
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      {lt.active ? "Deactivate" : "Activate"}
                    </button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenCreate(lt)}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={createTypeModalOpen} onOpenChange={setCreateTypeModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {editingType ? "Edit Leave Category" : "Create Custom Leave Category"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure parameters, accrual, carry-forward, encashment, and documentation rules.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveTypeMutation.mutate();
            }}
            className="space-y-4 py-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category Name</Label>
                <Input
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                  placeholder="Enter leave type name"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Short Code</Label>
                <Input
                  value={typeCode}
                  onChange={(e) => setTypeCode(e.target.value)}
                  placeholder="Enter leave code"
                  className="h-9 text-xs font-mono uppercase"
                  maxLength={5}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Annual Days Entitlement</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={typeDays}
                  onChange={(e) => setTypeDays(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Badge Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={typeColor}
                    onChange={(e) => setTypeColor(e.target.value)}
                    className="h-9 w-12 rounded cursor-pointer border"
                  />
                  <Input
                    value={typeColor}
                    onChange={(e) => setTypeColor(e.target.value)}
                    className="h-9 text-xs font-mono uppercase flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={typeDescription}
                onChange={(e) => setTypeDescription(e.target.value)}
                placeholder="Explain the purpose and usage policy of this leave..."
                rows={2}
                className="text-xs resize-none"
              />
            </div>

            {/* Checkbox Toggles */}
            <div className="space-y-2 rounded-lg border p-3 bg-muted/20 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Paid Leave Entitlement</span>
                <Switch checked={typeIsPaid} onCheckedChange={setTypeIsPaid} />
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span>Allow Half-Day Applications</span>
                <Switch checked={typeAllowHalfDay} onCheckedChange={setTypeAllowHalfDay} />
              </div>

              {/* Carry Forward */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span>Allow Year-End Carry-Forward</span>
                  <Switch
                    checked={typeAllowCarryForward}
                    onCheckedChange={setTypeAllowCarryForward}
                  />
                </div>
                {typeAllowCarryForward && (
                  <div className="flex items-center gap-2 pl-4">
                    <Label className="text-xs text-muted-foreground">Max Carry-Forward Days:</Label>
                    <Input
                      type="number"
                      value={typeMaxCarryForward}
                      onChange={(e) => setTypeMaxCarryForward(e.target.value)}
                      className="h-7 w-20 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Encashment */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span>Allow Leave Encashment</span>
                  <Switch
                    checked={typeAllowEncashment}
                    onCheckedChange={setTypeAllowEncashment}
                  />
                </div>
                {typeAllowEncashment && (
                  <div className="flex items-center gap-2 pl-4">
                    <Label className="text-xs text-muted-foreground">Max Encashment Days:</Label>
                    <Input
                      type="number"
                      value={typeMaxEncashment}
                      onChange={(e) => setTypeMaxEncashment(e.target.value)}
                      className="h-7 w-20 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Document Proof Requirement */}
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <span>Require Supporting Document Proof</span>
                  <Switch
                    checked={typeRequiresProof}
                    onCheckedChange={setTypeRequiresProof}
                  />
                </div>
                {typeRequiresProof && (
                  <div className="flex items-center gap-2 pl-4">
                    <Label className="text-xs text-muted-foreground">Required for leaves exceeding:</Label>
                    <Input
                      type="number"
                      value={typeProofMinDays}
                      onChange={(e) => setTypeProofMinDays(e.target.value)}
                      className="h-7 w-16 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreateTypeModalOpen(false)}
                className="text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveTypeMutation.isPending}
                className="text-xs h-9 gap-1.5"
              >
                {saveTypeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingType ? "Update Category" : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Run Annual Allocation Modal */}
      <Dialog open={allocationModalOpen} onOpenChange={setAllocationModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Run Annual Leave Allocation</DialogTitle>
            <DialogDescription className="text-xs">
              Credits annual baseline leave balances to all active employees and rolls forward eligible carry-forward days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Calendar Year</Label>
              <Input
                type="number"
                value={allocationYear}
                onChange={(e) => setAllocationYear(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="rounded-lg border p-3 bg-muted/20 text-xs space-y-1">
              <p className="font-semibold text-foreground">Automation Details:</p>
              <p className="text-muted-foreground">
                • Active employees will receive baseline days for all enabled leave types.
              </p>
              <p className="text-muted-foreground">
                • Unused balances from year {parseInt(allocationYear, 10) - 1} will be automatically carried forward up to configured maximum limits.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAllocationModalOpen(false)}
              className="text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => allocateMutation.mutate()}
              disabled={allocateMutation.isPending}
              className="text-xs h-9 gap-1.5 bg-primary text-white"
            >
              {allocateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate Allocations
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
