import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  EmployeeSalaryStructure,
  INDIAN_STATES,
  formatINR,
  calculateStatutoryComponents,
} from "@/lib/payroll";
import { Badge } from "@/components/ui/badge";
import { Calculator, Landmark, ShieldCheck } from "lucide-react";

interface SalaryStructureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: EmployeeSalaryStructure | null;
  employeeId?: string | undefined;
  organizationId?: string | undefined;
  employeeName?: string | undefined;
}

export function SalaryStructureModal({
  open,
  onOpenChange,
  structure,
  employeeId,
  organizationId,
  employeeName,
}: SalaryStructureModalProps) {
  const queryClient = useQueryClient();

  const [ctcAnnual, setCtcAnnual] = useState<number>(600000);
  const [basic, setBasic] = useState<number>(25000);
  const [hra, setHra] = useState<number>(12500);
  const [special, setSpecial] = useState<number>(9500);
  const [conveyance, setConveyance] = useState<number>(1500);
  const [medical, setMedical] = useState<number>(1500);
  const [otherAllowances, setOtherAllowances] = useState<number>(0);

  const [pfApplicable, setPfApplicable] = useState<boolean>(true);
  const [pfCapCeiling, setPfCapCeiling] = useState<boolean>(true);
  const [esiApplicable, setEsiApplicable] = useState<boolean>(false);
  const [ptApplicable, setPtApplicable] = useState<boolean>(true);
  const [ptState, setPtState] = useState<string>("Karnataka");
  const [tdsMonthly, setTdsMonthly] = useState<number>(0);

  const [bankName, setBankName] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [ifscCode, setIfscCode] = useState<string>("");
  const [panNumber, setPanNumber] = useState<string>("");
  const [uanNumber, setUanNumber] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (structure) {
      setCtcAnnual(structure.ctc_annual || 600000);
      setBasic(structure.basic_salary || 25000);
      setHra(structure.hra || 12500);
      setSpecial(structure.special_allowance || 9500);
      setConveyance(structure.conveyance_allowance || 1500);
      setMedical(structure.medical_allowance || 1500);
      setOtherAllowances(structure.other_allowances || 0);

      setPfApplicable(structure.pf_applicable ?? true);
      setPfCapCeiling(structure.pf_cap_at_ceiling ?? true);
      setEsiApplicable(structure.esi_applicable ?? false);
      setPtApplicable(structure.pt_applicable ?? true);
      setPtState(structure.pt_state || "Karnataka");
      setTdsMonthly(structure.tds_monthly || 0);

      setBankName(structure.bank_name || "");
      setAccountNumber(structure.bank_account_number || "");
      setIfscCode(structure.bank_ifsc_code || "");
      setPanNumber(structure.pan_number || "");
      setUanNumber(structure.uan_number || "");
    } else {
      setCtcAnnual(600000);
      setBasic(25000);
      setHra(12500);
      setSpecial(9500);
      setConveyance(1500);
      setMedical(1500);
      setOtherAllowances(0);
      setPfApplicable(true);
      setPfCapCeiling(true);
      setEsiApplicable(false);
      setPtApplicable(true);
      setPtState("Karnataka");
      setTdsMonthly(0);
      setBankName("");
      setAccountNumber("");
      setIfscCode("");
      setPanNumber("");
      setUanNumber("");
    }
  }, [open, structure, employeeId]);

  // Auto-distribute CTC standard Indian breakdown
  function autoCalculateBreakdown(annual: number) {
    const monthly = annual / 12;
    const calcBasic = Math.round(monthly * 0.5); // 50% basic
    const calcHra = Math.round(calcBasic * 0.5); // 50% of basic
    const calcConveyance = 1600;
    const calcMedical = 1250;
    const calcSpecial = Math.max(0, monthly - (calcBasic + calcHra + calcConveyance + calcMedical));

    setCtcAnnual(annual);
    setBasic(calcBasic);
    setHra(calcHra);
    setConveyance(calcConveyance);
    setMedical(calcMedical);
    setSpecial(calcSpecial);
    setOtherAllowances(0);

    // ESI applies if monthly <= 21000
    setEsiApplicable(monthly <= 21000);
  }

  const monthlyGross = basic + hra + special + conveyance + medical + otherAllowances;
  const stat = calculateStatutoryComponents({
    monthlyGross,
    basic,
    pfApplicable,
    pfCapAtCeiling: pfCapCeiling,
    esiApplicable,
    ptApplicable,
    ptState,
    tdsMonthly,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const empId = structure?.employee_id || employeeId;
      if (!empId) throw new Error("Employee ID is missing.");

      const payload = {
        employee_id: empId,
        organization_id: structure?.organization_id || organizationId || null,
        ctc_annual: ctcAnnual,
        ctc_monthly: Math.round(ctcAnnual / 12),
        basic_salary: basic,
        hra,
        special_allowance: special,
        conveyance_allowance: conveyance,
        medical_allowance: medical,
        other_allowances: otherAllowances,
        pf_applicable: pfApplicable,
        pf_cap_at_ceiling: pfCapCeiling,
        esi_applicable: esiApplicable,
        pt_applicable: ptApplicable,
        pt_state: ptState,
        tds_monthly: tdsMonthly,
        bank_name: bankName || null,
        bank_account_number: accountNumber || null,
        bank_ifsc_code: ifscCode || null,
        pan_number: panNumber || null,
        uan_number: uanNumber || null,
        is_active: true,
        effective_from: new Date().toISOString().split("T")[0]!,
      };

      if (structure?.id) {
        const { error } = await supabase
          .from("employee_salary_structures")
          .update(payload)
          .eq("id", structure.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_salary_structures")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["salary-structures"] });
      queryClient.invalidateQueries({ queryKey: ["employee-salary-structure"] });
      toast.success("Salary structure successfully updated.");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update salary structure.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-primary" />
            Configure Salary Structure
          </DialogTitle>
          <DialogDescription>
            Tailor Indian statutory rates, allowances, and banking coordinates for{" "}
            <span className="font-semibold text-foreground">
              {structure?.employee?.full_name || employeeName || "Employee"}
            </span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* CTC Auto Preset */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">
                  Annual Cost to Company (CTC)
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={ctcAnnual}
                    onChange={(e) => setCtcAnnual(Number(e.target.value) || 0)}
                    className="w-48 font-semibold text-base"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => autoCalculateBreakdown(ctcAnnual)}
                    className="text-xs"
                  >
                    Auto-Fill 50% Basic
                  </Button>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Monthly CTC Equivalent</span>
                <p className="text-lg font-bold text-primary">
                  {formatINR(ctcAnnual / 12)}
                </p>
              </div>
            </div>
          </div>

          {/* Earnings Breakdown */}
          <div>
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Monthly Earnings Breakdown
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Basic Salary (₹)</Label>
                <Input
                  type="number"
                  value={basic}
                  onChange={(e) => setBasic(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">House Rent Allowance (HRA)</Label>
                <Input
                  type="number"
                  value={hra}
                  onChange={(e) => setHra(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Special Allowance</Label>
                <Input
                  type="number"
                  value={special}
                  onChange={(e) => setSpecial(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Conveyance Allowance</Label>
                <Input
                  type="number"
                  value={conveyance}
                  onChange={(e) => setConveyance(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Medical Allowance</Label>
                <Input
                  type="number"
                  value={medical}
                  onChange={(e) => setMedical(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Other Allowances</Label>
                <Input
                  type="number"
                  value={otherAllowances}
                  onChange={(e) => setOtherAllowances(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="mt-2 text-right text-xs text-muted-foreground">
              Total Monthly Gross: <span className="font-bold text-foreground">{formatINR(monthlyGross)}</span>
            </div>
          </div>

          {/* Statutory Settings */}
          <div className="border-t pt-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-primary" /> Indian Statutory Deductions
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/10 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Provident Fund (EPF)</Label>
                  <p className="text-[11px] text-muted-foreground">12% deduction</p>
                </div>
                <Switch checked={pfApplicable} onCheckedChange={setPfApplicable} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Cap PF at ₹15,000 Ceiling</Label>
                  <p className="text-[11px] text-muted-foreground">Max ₹1,800/mo</p>
                </div>
                <Switch
                  checked={pfCapCeiling}
                  onCheckedChange={setPfCapCeiling}
                  disabled={!pfApplicable}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Employee State Insurance (ESI)</Label>
                  <p className="text-[11px] text-muted-foreground">0.75% if gross ≤ ₹21,000</p>
                </div>
                <Switch checked={esiApplicable} onCheckedChange={setEsiApplicable} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Professional Tax (PT)</Label>
                  <p className="text-[11px] text-muted-foreground">State slab deduction</p>
                </div>
                <Switch checked={ptApplicable} onCheckedChange={setPtApplicable} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">PT Applicable State</Label>
                <Select value={ptState} onValueChange={setPtState} disabled={!ptApplicable}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Monthly TDS / Income Tax (₹)</Label>
                <Input
                  type="number"
                  value={tdsMonthly}
                  onChange={(e) => setTdsMonthly(Number(e.target.value) || 0)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Statutory Projection Preview */}
          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 rounded-lg text-xs space-y-1.5">
            <div className="font-semibold text-indigo-900 dark:text-indigo-300">
              Computed Monthly Projection:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div>Gross: <span className="font-bold">{formatINR(stat.grossPayable)}</span></div>
              <div>EPF: <span className="font-bold text-amber-600">{formatINR(stat.pfEmployee)}</span></div>
              <div>PT: <span className="font-bold text-amber-600">{formatINR(stat.professionalTax)}</span></div>
              <div>Net Take-Home: <span className="font-bold text-emerald-600">{formatINR(stat.netPayable)}</span></div>
            </div>
          </div>

          {/* Banking & Identity Details */}
          <div className="border-t pt-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Landmark className="h-4 w-4 text-primary" /> Banking & Statutory Registration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Bank Name</Label>
                <Input
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Account Number</Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 5010049281923"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">IFSC Code</Label>
                <Input
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="HDFC0001234"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">PAN Number</Label>
                <Input
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  className="h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">EPF UAN Number</Label>
                <Input
                  value={uanNumber}
                  onChange={(e) => setUanNumber(e.target.value)}
                  placeholder="100918239012"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Salary Structure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
