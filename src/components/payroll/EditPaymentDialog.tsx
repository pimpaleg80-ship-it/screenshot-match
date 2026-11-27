import { useEffect, useState } from "react";
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
  formatINR,
  type EmployeeSalaryStructure,
  type PayslipItem,
} from "@/lib/payroll";
import { Pencil } from "lucide-react";

export interface EditablePayrollEmployee {
  id: string;
  full_name: string;
  employee_code: string;
  designation?: string | null | undefined;
}

interface EditPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payrollRunId: string | null;
  runTitle: string;
  employee: EditablePayrollEmployee | null;
  payslip: PayslipItem | null;
  structure: EmployeeSalaryStructure | null;
}

const numOrZero = (value: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function EditPaymentDialog({
  open,
  onOpenChange,
  payrollRunId,
  runTitle,
  employee,
  payslip,
  structure,
}: EditPaymentDialogProps) {
  const queryClient = useQueryClient();

  const [basic, setBasic] = useState(25000);
  const [hra, setHra] = useState(12500);
  const [special, setSpecial] = useState(9500);
  const [conveyance, setConveyance] = useState(1500);
  const [medical, setMedical] = useState(1500);
  const [otherAllowances, setOtherAllowances] = useState(0);
  const [bonus, setBonus] = useState(0);
  const [overtimePay, setOvertimePay] = useState(0);

  const [pfEmployee, setPfEmployee] = useState(1800);
  const [esiEmployee, setEsiEmployee] = useState(0);
  const [professionalTax, setProfessionalTax] = useState(200);
  const [tds, setTds] = useState(0);
  const [lopDeduction, setLopDeduction] = useState(0);
  const [otherDeductions, setOtherDeductions] = useState(0);

  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (payslip) {
      setBasic(Number(payslip.basic_salary || 0));
      setHra(Number(payslip.hra || 0));
      setSpecial(Number(payslip.special_allowance || 0));
      setConveyance(Number(payslip.conveyance_allowance || 0));
      setMedical(Number(payslip.medical_allowance || 0));
      setOtherAllowances(Number(payslip.other_allowances || 0));
      setBonus(Number(payslip.bonus || 0));
      setOvertimePay(Number(payslip.overtime_pay || 0));
      setPfEmployee(Number(payslip.pf_employee || 0));
      setEsiEmployee(Number(payslip.esi_employee || 0));
      setProfessionalTax(Number(payslip.professional_tax || 0));
      setTds(Number(payslip.tds || 0));
      setLopDeduction(Number(payslip.lop_deduction || 0));
      setOtherDeductions(Number(payslip.other_deductions || 0));
      setPaymentMethod(payslip.payment_method || "bank_transfer");
      setNotes(payslip.notes || "");
      return;
    }

    if (structure) {
      setBasic(Number(structure.basic_salary || 0));
      setHra(Number(structure.hra || 0));
      setSpecial(Number(structure.special_allowance || 0));
      setConveyance(Number(structure.conveyance_allowance || 0));
      setMedical(Number(structure.medical_allowance || 0));
      setOtherAllowances(Number(structure.other_allowances || 0));
      setBonus(0);
      setOvertimePay(0);
      setPfEmployee(
        structure.pf_applicable
          ? Math.round((structure.pf_cap_at_ceiling ? Math.min(structure.basic_salary, 15000) : structure.basic_salary) * 0.12)
          : 0,
      );
      setEsiEmployee(0);
      setProfessionalTax(structure.pt_applicable ? 200 : 0);
      setTds(Number(structure.tds_monthly || 0));
      setLopDeduction(0);
      setOtherDeductions(0);
      setPaymentMethod("bank_transfer");
      setNotes("");
      return;
    }

    setBasic(25000);
    setHra(12500);
    setSpecial(9500);
    setConveyance(1500);
    setMedical(1500);
    setOtherAllowances(0);
    setBonus(0);
    setOvertimePay(0);
    setPfEmployee(1800);
    setEsiEmployee(0);
    setProfessionalTax(200);
    setTds(0);
    setLopDeduction(0);
    setOtherDeductions(0);
    setPaymentMethod("bank_transfer");
    setNotes("");
  }, [open, payslip, structure, employee?.id]);

  const grossSalary =
    basic + hra + special + conveyance + medical + otherAllowances + bonus + overtimePay;
  const totalDeductions =
    pfEmployee + esiEmployee + professionalTax + tds + lopDeduction + otherDeductions;
  const netSalary = Math.max(0, grossSalary - totalDeductions);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!payrollRunId || !employee?.id) {
        throw new Error("Payroll run or employee missing.");
      }

      const { data, error } = await supabase.rpc("update_employee_payslip", {
        _payroll_run_id: payrollRunId,
        _employee_id: employee.id,
        _basic_salary: basic,
        _hra: hra,
        _special_allowance: special,
        _conveyance_allowance: conveyance,
        _medical_allowance: medical,
        _other_allowances: otherAllowances,
        _bonus: bonus,
        _overtime_pay: overtimePay,
        _pf_employee: pfEmployee,
        _esi_employee: esiEmployee,
        _professional_tax: professionalTax,
        _tds: tds,
        _lop_deduction: lopDeduction,
        _other_deductions: otherDeductions,
        _payment_method: paymentMethod,
        _notes: notes.trim() || null,
      });

      if (error) throw error;
      const res = data as { success?: boolean; error?: string } | null;
      if (!res?.success) {
        throw new Error(res?.error || "Failed to update employee payment.");
      }
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["payroll-runs"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll-run-payslips"] });
      void queryClient.invalidateQueries({ queryKey: ["payroll-report-payslips"] });
      toast.success(`Saved payment for ${employee?.full_name}`);
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to save payment");
    },
  });

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="h-4 w-4 text-primary" />
            Edit Payment — {employee.full_name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {employee.employee_code} · {runTitle}. Batch totals recalculate automatically on save.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1 text-xs">
          <div>
            <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-2">
              Earnings (₹)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Basic Salary", val: basic, set: setBasic },
                { label: "HRA", val: hra, set: setHra },
                { label: "Special Allow.", val: special, set: setSpecial },
                { label: "Conveyance", val: conveyance, set: setConveyance },
                { label: "Medical", val: medical, set: setMedical },
                { label: "Other Allow.", val: otherAllowances, set: setOtherAllowances },
                { label: "Bonus", val: bonus, set: setBonus },
                { label: "Overtime Pay", val: overtimePay, set: setOvertimePay },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <Label className="text-[11px]">{item.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.val}
                    onChange={(e) => item.set(numOrZero(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-2">
              Deductions (₹)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: "EPF Employee", val: pfEmployee, set: setPfEmployee },
                { label: "ESI Employee", val: esiEmployee, set: setEsiEmployee },
                { label: "Professional Tax", val: professionalTax, set: setProfessionalTax },
                { label: "TDS / Income Tax", val: tds, set: setTds },
                { label: "LOP Deduction", val: lopDeduction, set: setLopDeduction },
                { label: "Other Deductions", val: otherDeductions, set: setOtherDeductions },
              ].map((item) => (
                <div key={item.label} className="space-y-1">
                  <Label className="text-[11px]">{item.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.val}
                    onChange={(e) => item.set(numOrZero(e.target.value))}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer (NEFT / IMPS)</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Notes / Adjustment Reason</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional adjustment note"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3">
            <div>
              <span className="text-[11px] text-muted-foreground block">Gross Earnings</span>
              <span className="font-bold text-foreground">{formatINR(grossSalary)}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Total Deductions</span>
              <span className="font-bold text-rose-600">{formatINR(totalDeductions)}</span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Net Take-Home</span>
              <span className="font-bold text-emerald-600 text-sm">{formatINR(netSalary)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving..." : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
