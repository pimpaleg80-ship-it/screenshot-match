import React from "react";
import { LmsCertificate } from "@/lib/performance-lms";
import { Award, CheckCircle2, Download, Printer, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CertificateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: LmsCertificate | null;
}

export function CertificateViewDialog({
  open,
  onOpenChange,
  certificate,
}: CertificateViewDialogProps) {
  if (!certificate) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white text-zinc-900 border-zinc-200">
        <div className="p-6 sm:p-10 relative bg-gradient-to-br from-amber-50/60 via-white to-blue-50/40 border-8 border-double border-amber-500/20 m-2 rounded-lg">
          {/* Certificate Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 text-amber-600 mb-2 border-2 border-amber-500/30">
              <Award className="w-9 h-9" />
            </div>
            <p className="text-xs font-bold tracking-widest text-amber-700 uppercase">
              FlowPeople Human Resource Management System
            </p>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold text-zinc-900 tracking-tight">
              Certificate of Completion
            </h1>
            <p className="text-sm text-zinc-500 italic max-w-md mx-auto">
              This official certificate is proudly presented to
            </p>
          </div>

          {/* Recipient */}
          <div className="text-center my-6 sm:my-8 space-y-1">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-primary border-b-2 border-amber-500/30 pb-2 inline-block px-8">
              {certificate.employee?.full_name || "Employee"}
            </h2>
            <p className="text-xs text-zinc-500 font-mono mt-1">
              Employee ID: {certificate.employee?.employee_code || "EMP-000"}
              {certificate.employee?.designation ? ` • ${certificate.employee.designation}` : ""}
            </p>
          </div>

          {/* Course Details */}
          <div className="text-center space-y-2 max-w-lg mx-auto">
            <p className="text-sm text-zinc-600">
              for successfully completing all curriculum modules, practical assessments, and evaluation requirements for
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-zinc-900">
              {certificate.course?.title || "Professional Training Course"}
            </h3>
            <p className="text-xs text-zinc-500">
              Category: {certificate.course?.category || "Professional Development"}
              {certificate.final_score_percent
                ? ` • Passing Score: ${certificate.final_score_percent}%`
                : ""}
            </p>
          </div>

          {/* Certificate Footer with Verification */}
          <div className="mt-10 pt-6 border-t border-zinc-200/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <div className="text-center sm:text-left space-y-0.5">
              <div className="flex items-center gap-1 font-semibold text-zinc-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Certificate</span>
              </div>
              <p className="font-mono text-[11px]">
                ID: <strong>{certificate.certificate_code}</strong>
              </p>
            </div>

            <div className="text-center sm:text-right space-y-0.5">
              <p className="font-medium text-zinc-700">
                Date of Issue: <strong>{new Date(certificate.issue_date).toLocaleDateString()}</strong>
              </p>
              <p className="text-[11px] text-zinc-400">FlowPeople LMS Accreditation</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" />
            <span>Print Certificate</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
