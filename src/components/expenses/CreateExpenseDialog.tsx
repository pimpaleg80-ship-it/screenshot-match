import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Upload, Paperclip, Loader2, X, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { EXPENSE_CATEGORIES } from "@/lib/expenses";

interface CreateExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string;
  onSuccess?: () => void;
}

export function CreateExpenseDialog({
  open,
  onOpenChange,
  employeeId,
  onSuccess,
}: CreateExpenseDialogProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setTitle("");
    setCategory(EXPENSE_CATEGORIES[0]);
    setAmount("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setReceiptFile(null);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const parsedAmount = parseFloat(amount);
      if (!title.trim()) throw new Error("Please enter an expense claim title");
      if (isNaN(parsedAmount) || parsedAmount <= 0) throw new Error("Please enter a valid amount greater than zero");
      if (!expenseDate) throw new Error("Please select the expense date");

      let receiptUrl: string | null = null;
      let receiptStoragePath: string | null = null;
      let receiptName: string | null = null;
      let receiptSize: number | null = null;

      if (receiptFile) {
        setIsUploading(true);
        receiptName = receiptFile.name;
        receiptSize = receiptFile.size;
        const fileExt = receiptFile.name.split(".").pop();
        const path = `receipts/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("expense-receipts")
          .upload(path, receiptFile);

        if (uploadErr) {
          console.warn("Storage upload warning, falling back to documents bucket:", uploadErr.message);
          const { data: docData, error: docErr } = await supabase.storage
            .from("documents")
            .upload(`expense_receipt/${Date.now()}_${receiptFile.name}`, receiptFile);
          if (docErr) throw new Error("Failed to upload receipt: " + docErr.message);
          receiptUrl = docData?.path || null;
          receiptStoragePath = docData?.path || null;
        } else {
          receiptUrl = uploadData?.path || null;
          receiptStoragePath = uploadData?.path || null;
        }
      }

      // Call transactional RPC
      const { data, error } = await supabase.rpc("submit_expense_claim", {
        p_title: title.trim(),
        p_category: category,
        p_amount: parsedAmount,
        p_expense_date: expenseDate,
        p_notes: notes.trim() || null,
        p_receipt_url: receiptUrl,
        p_receipt_storage_path: receiptStoragePath,
        p_receipt_name: receiptName,
        p_receipt_size: receiptSize,
        p_employee_id: employeeId || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Expense claim submitted for manager review");
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["my-expense-claims"] });
      queryClient.invalidateQueries({ queryKey: ["expense-summary"] });
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit expense claim");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <span>Submit Expense Claim</span>
          </DialogTitle>
          <DialogDescription>
            Submit an employee expense for business travel, food, accommodation, transport, or supplies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-title" className="text-xs font-semibold">
              Claim Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="exp-title"
              placeholder="Enter expense claim title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Category & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Expense Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-amount" className="text-xs font-semibold">
                Amount (INR ₹) <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">
                  ₹
                </span>
                <Input
                  id="exp-amount"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-7 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Expense Date */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-date" className="text-xs font-semibold">
              Expense Date <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="exp-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Description / Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-notes" className="text-xs font-semibold">
              Business Purpose & Notes
            </Label>
            <Textarea
              id="exp-notes"
              rows={3}
              placeholder="Explain business necessity, attendees, project reference or journey details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Receipt / Bill Proof</Label>
            <div className="rounded-lg border border-dashed p-3 bg-muted/20 text-center hover:bg-muted/40 transition-colors">
              {receiptFile ? (
                <div className="flex items-center justify-between bg-card p-2 rounded border text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{receiptFile.name}</span>
                    <span className="text-muted-foreground text-[11px]">
                      ({Math.round(receiptFile.size / 1024)} KB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:text-rose-500"
                    onClick={() => setReceiptFile(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                  <span className="text-xs text-primary font-medium hover:underline">
                    Click to upload receipt, invoice, or boarding pass
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    PDF, PNG, JPG (Stored securely in private cloud storage)
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files?.[0]) setReceiptFile(e.target.files[0]);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending || isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => submitMutation.mutate()}
            disabled={
              submitMutation.isPending ||
              isUploading ||
              !title.trim() ||
              !amount ||
              parseFloat(amount) <= 0
            }
            className="gap-2"
          >
            {(submitMutation.isPending || isUploading) && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <span>Submit Claim</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
