import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Eye,
  Download,
  ShieldAlert,
  Calendar,
  User,
} from "lucide-react";
import {
  DocumentItem,
  getExpiryStatus,
  getVerificationStatusBadge,
  getSecureDocumentUrl,
} from "@/lib/documents";
import { formatDate } from "@/lib/attendance";

interface DocumentExpiryLedgerProps {
  documents: DocumentItem[];
  onPreview: (doc: DocumentItem) => void;
  onVerify?: (doc: DocumentItem) => void;
  canVerify?: boolean;
}

export function DocumentExpiryLedger({
  documents,
  onPreview,
  onVerify,
  canVerify = false,
}: DocumentExpiryLedgerProps) {
  const [filterRange, setFilterRange] = useState<string>("all_expiring"); // "all_expiring", "expired", "30d", "60d", "90d"
  const [search, setSearch] = useState("");

  // Only consider documents that have an expiry date set
  const documentsWithExpiry = documents.filter((d) => Boolean(d.expiry_date));

  // Compute stats
  const expiredDocs = documentsWithExpiry.filter((d) => {
    const info = getExpiryStatus(d.expiry_date);
    return info.status === "expired";
  });

  const expiring30d = documentsWithExpiry.filter((d) => {
    const info = getExpiryStatus(d.expiry_date);
    return info.status === "expiring_soon";
  });

  const expiring60d = documentsWithExpiry.filter((d) => {
    const info = getExpiryStatus(d.expiry_date);
    return (
      info.daysRemaining !== null &&
      info.daysRemaining >= 0 &&
      info.daysRemaining <= 60
    );
  });

  const expiring90d = documentsWithExpiry.filter((d) => {
    const info = getExpiryStatus(d.expiry_date);
    return (
      info.daysRemaining !== null &&
      info.daysRemaining >= 0 &&
      info.daysRemaining <= 90
    );
  });

  const filteredDocs = documentsWithExpiry.filter((doc) => {
    const info = getExpiryStatus(doc.expiry_date);

    // Range filter
    if (filterRange === "expired" && info.status !== "expired") return false;
    if (filterRange === "30d" && info.status !== "expiring_soon") return false;
    if (
      filterRange === "60d" &&
      (info.daysRemaining === null ||
        info.daysRemaining < 0 ||
        info.daysRemaining > 60)
    )
      return false;
    if (
      filterRange === "90d" &&
      (info.daysRemaining === null ||
        info.daysRemaining < 0 ||
        info.daysRemaining > 90)
    )
      return false;

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchEmp = doc.employees?.full_name?.toLowerCase().includes(q);
      const matchCode = doc.employees?.employee_code?.toLowerCase().includes(q);
      const matchCat = doc.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchEmp && !matchCode && !matchCat) return false;
    }

    return true;
  });

  // Sort: expired first, then earliest expiring
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    const aDays = getExpiryStatus(a.expiry_date).daysRemaining ?? 9999;
    const bDays = getExpiryStatus(b.expiry_date).daysRemaining ?? 9999;
    return aDays - bDays;
  });

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const url = await getSecureDocumentUrl(doc.file_url || doc.drive_link || "");
      if (!url) return;
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.file_name || doc.title || "document";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition border-2 ${
            filterRange === "expired"
              ? "border-rose-500 bg-rose-500/5 shadow-md"
              : "hover:border-rose-500/40"
          }`}
          onClick={() => setFilterRange("expired")}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>EXPIRED DOCUMENTS</span>
              <ShieldAlert className="w-4 h-4 text-rose-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {expiredDocs.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Requires immediate renewal & re-verification
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition border-2 ${
            filterRange === "30d"
              ? "border-amber-500 bg-amber-500/5 shadow-md"
              : "hover:border-amber-500/40"
          }`}
          onClick={() => setFilterRange("30d")}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>EXPIRING IN 30 DAYS</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {expiring30d.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            High priority expiry notifications
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition border-2 ${
            filterRange === "60d"
              ? "border-indigo-500 bg-indigo-500/5 shadow-md"
              : "hover:border-indigo-500/40"
          }`}
          onClick={() => setFilterRange("60d")}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>EXPIRING IN 60 DAYS</span>
              <Calendar className="w-4 h-4 text-indigo-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {expiring60d.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Upcoming renewals in 2 months
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition border-2 ${
            filterRange === "all_expiring"
              ? "border-primary bg-primary/5 shadow-md"
              : "hover:border-primary/40"
          }`}
          onClick={() => setFilterRange("all_expiring")}
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold">
              <span>TOTAL MONITORED</span>
              <CheckCircle2 className="w-4 h-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {documentsWithExpiry.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Documents with tracked expiration dates
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employee, document, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={filterRange} onValueChange={setFilterRange}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
              <SelectValue placeholder="Filter Expiry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_expiring">All Tracked Documents</SelectItem>
              <SelectItem value="expired">Expired Only</SelectItem>
              <SelectItem value="30d">Expiring in 30 Days</SelectItem>
              <SelectItem value="60d">Expiring in 60 Days</SelectItem>
              <SelectItem value="90d">Expiring in 90 Days</SelectItem>
            </SelectContent>
          </Select>

          {filterRange !== "all_expiring" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFilterRange("all_expiring")}
              className="text-xs h-9 px-2 text-muted-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table of Expiring Documents */}
      <Card>
        <CardContent className="p-0">
          {sortedDocs.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="font-semibold text-foreground">
                No documents matching filter
              </h3>
              <p className="text-xs text-muted-foreground">
                All tracked employee documents are currently valid and up to date.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Employee</TableHead>
                    <TableHead>Document Details</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Status / Remaining</TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedDocs.map((doc) => {
                    const expiry = getExpiryStatus(doc.expiry_date);
                    const verify = getVerificationStatusBadge(
                      doc.verification_status
                    );

                    return (
                      <TableRow key={doc.id} className="hover:bg-muted/40">
                        {/* Employee */}
                        <TableCell>
                          {doc.employees ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-muted-foreground" />
                                {doc.employees.full_name}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {doc.employees.employee_code}
                                {doc.employees.departments?.name &&
                                  ` • ${doc.employees.departments.name}`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Company Wide
                            </span>
                          )}
                        </TableCell>

                        {/* Document details */}
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium text-foreground text-sm flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              {doc.title}
                            </p>
                            {doc.file_name && (
                              <p className="text-xs text-muted-foreground truncate max-w-xs">
                                {doc.file_name}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Category */}
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {doc.category}
                          </Badge>
                        </TableCell>

                        {/* Expiry Date */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs font-mono">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>{formatDate(doc.expiry_date!)}</span>
                          </div>
                        </TableCell>

                        {/* Status / Remaining */}
                        <TableCell>
                          <Badge variant="outline" className={expiry.colorClass}>
                            {expiry.label}
                          </Badge>
                        </TableCell>

                        {/* Verification */}
                        <TableCell>
                          <Badge variant="outline" className={verify.colorClass}>
                            {verify.label}
                          </Badge>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Preview Document"
                              onClick={() => onPreview(doc)}
                            >
                              <Eye className="w-4 h-4 text-foreground" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Download File"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="w-4 h-4 text-muted-foreground" />
                            </Button>

                            {canVerify &&
                              onVerify &&
                              doc.verification_status !== "verified" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400"
                                  onClick={() => onVerify(doc)}
                                >
                                  Verify
                                </Button>
                              )}
                          </div>
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
  );
}
