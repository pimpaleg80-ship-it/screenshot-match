import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ScanFace } from "lucide-react";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}

export function MobileMenu({ isOpen, onClose, isLoggedIn }: MobileMenuProps) {
  if (!isOpen) return null;

  const handleLinkClick = (hashId?: string) => {
    onClose();
    if (hashId) {
      const el = document.getElementById(hashId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div
      id="mobile-menu"
      className="border-t border-slate-200 bg-white px-4 sm:px-6 pb-4 pt-2 shadow-lg lg:hidden"
    >
      <nav className="flex flex-col divide-y divide-slate-100" aria-label="Mobile Navigation">
        <a
          href="#features"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("features");
          }}
          className="py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          Features
        </a>
        <a
          href="#geofencing"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("geofencing");
          }}
          className="py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          Geofencing
        </a>
        <a
          href="#cloud-backup"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("cloud-backup");
          }}
          className="py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          Cloud Backup
        </a>
        <a
          href="#security"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick("security");
          }}
          className="py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          Security
        </a>
        <Link
          to="/privacy-policy"
          onClick={onClose}
          className="py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          Privacy Policy
        </Link>
        <Link
          to="/terms"
          onClick={onClose}
          className="py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          Terms &amp; Conditions
        </Link>
        <Link
          to="/kiosk"
          onClick={onClose}
          className="flex items-center gap-2 py-3 text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors"
        >
          <ScanFace className="h-4 w-4 text-indigo-600" />
          Kiosk Mode
        </Link>
      </nav>

      <div className="pt-3">
        <Link
          to={isLoggedIn ? "/dashboard" : "/auth"}
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          {isLoggedIn ? "Open Dashboard" : "Sign In to Workspace"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
