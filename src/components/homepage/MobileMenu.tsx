import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
}

export function MobileMenu({ isOpen, onClose, isLoggedIn }: MobileMenuProps) {
  const pathname = useLocation({ select: (l) => l.pathname });
  const isHome = pathname === "/";

  if (!isOpen) return null;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, hashId?: string) => {
    onClose();
    if (isHome && hashId) {
      e.preventDefault();
      const el = document.getElementById(hashId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  return (
    <div
      id="mobile-menu"
      className="border-t border-[#E5EAF4] bg-white px-4 sm:px-6 pb-4 pt-2 shadow-md lg:hidden"
    >
      <nav className="flex flex-col divide-y divide-[#E5EAF4]/70" aria-label="Mobile Navigation">
        <a
          href={isHome ? "#features" : "/#features"}
          onClick={(e) => handleLinkClick(e, "features")}
          className="py-3 text-sm font-medium text-[#172554] hover:text-[#315EFB] transition-colors"
        >
          Features
        </a>
        <a
          href={isHome ? "#geofencing" : "/#geofencing"}
          onClick={(e) => handleLinkClick(e, "geofencing")}
          className="py-3 text-sm font-medium text-[#172554] hover:text-[#315EFB] transition-colors"
        >
          Geofencing
        </a>
        <a
          href={isHome ? "#cloud-backup" : "/#cloud-backup"}
          onClick={(e) => handleLinkClick(e, "cloud-backup")}
          className="py-3 text-sm font-medium text-[#172554] hover:text-[#315EFB] transition-colors"
        >
          Cloud Backup
        </a>
        <a
          href={isHome ? "#security" : "/#security"}
          onClick={(e) => handleLinkClick(e, "security")}
          className="py-3 text-sm font-medium text-[#172554] hover:text-[#315EFB] transition-colors"
        >
          Security
        </a>
        <Link
          to="/privacy-policy"
          onClick={onClose}
          className="py-3 text-sm font-medium text-[#172554] hover:text-[#315EFB] transition-colors"
        >
          Privacy Policy
        </Link>
        <Link
          to="/terms"
          onClick={onClose}
          className="py-3 text-sm font-medium text-[#172554] hover:text-[#315EFB] transition-colors"
        >
          Terms &amp; Conditions
        </Link>
      </nav>

      <div className="pt-3">
        <Link
          to={isLoggedIn ? "/dashboard" : "/auth"}
          onClick={onClose}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#315EFB] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#254EDB]"
        >
          {isLoggedIn ? "Open Dashboard" : "Sign In to Workspace"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
