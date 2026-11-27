import React, { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { FlowPeopleLogo } from "./FlowPeopleLogo";
import { MobileMenu } from "./MobileMenu";
import { useSession } from "@/hooks/use-session";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const pathname = useLocation({ select: (l) => l.pathname });
  const isHome = pathname === "/";
  const isPrivacy = pathname === "/privacy-policy" || pathname === "/privacy";
  const isTerms = pathname === "/terms" || pathname === "/terms-and-conditions";
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);

  // Scroll spy effect on landing page
  useEffect(() => {
    if (!isHome) {
      setActiveSection("");
      return;
    }
    const sectionIds = ["features", "geofencing", "cloud-backup", "security"];
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(id);
            return;
          }
        }
      }
      if (window.scrollY < 200) {
        setActiveSection("");
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHome]);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!isHome) return;
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      id="top"
      className="sticky top-0 z-40 border-b border-[#E5EAF4] bg-white"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <FlowPeopleLogo />

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Desktop Navigation */}
          <nav className="hidden h-16 items-center lg:flex" aria-label="Primary Navigation">
            <a
              href={isHome ? "#features" : "/#features"}
              onClick={(e) => scrollToSection(e, "features")}
              className={`relative flex h-full cursor-pointer items-center px-3 text-sm font-medium transition-colors ${
                activeSection === "features"
                  ? "font-semibold text-[#172554]"
                  : "text-[#64748B] hover:text-[#172554]"
              }`}
            >
              Features
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#315EFB] transition-transform duration-300 ${
                  activeSection === "features" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <a
              href={isHome ? "#geofencing" : "/#geofencing"}
              onClick={(e) => scrollToSection(e, "geofencing")}
              className={`relative flex h-full cursor-pointer items-center px-3 text-sm font-medium transition-colors ${
                activeSection === "geofencing"
                  ? "font-semibold text-[#172554]"
                  : "text-[#64748B] hover:text-[#172554]"
              }`}
            >
              Geofencing
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#315EFB] transition-transform duration-300 ${
                  activeSection === "geofencing" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <a
              href={isHome ? "#cloud-backup" : "/#cloud-backup"}
              onClick={(e) => scrollToSection(e, "cloud-backup")}
              className={`relative flex h-full cursor-pointer items-center px-3 text-sm font-medium transition-colors ${
                activeSection === "cloud-backup"
                  ? "font-semibold text-[#172554]"
                  : "text-[#64748B] hover:text-[#172554]"
              }`}
            >
              Cloud Backup
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#315EFB] transition-transform duration-300 ${
                  activeSection === "cloud-backup" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <a
              href={isHome ? "#security" : "/#security"}
              onClick={(e) => scrollToSection(e, "security")}
              className={`relative flex h-full cursor-pointer items-center px-3 text-sm font-medium transition-colors ${
                activeSection === "security"
                  ? "font-semibold text-[#172554]"
                  : "text-[#64748B] hover:text-[#172554]"
              }`}
            >
              Security
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#315EFB] transition-transform duration-300 ${
                  activeSection === "security" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <Link
              to="/privacy-policy"
              className={`relative flex h-full cursor-pointer items-center px-3 text-sm font-medium transition-colors ${
                isPrivacy ? "font-semibold text-[#172554]" : "text-[#64748B] hover:text-[#172554]"
              }`}
            >
              Privacy
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#315EFB] transition-transform duration-300 ${
                  isPrivacy ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </Link>
            <Link
              to="/terms"
              className={`relative flex h-full cursor-pointer items-center px-3 text-sm font-medium transition-colors ${
                isTerms ? "font-semibold text-[#172554]" : "text-[#64748B] hover:text-[#172554]"
              }`}
            >
              Terms
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#315EFB] transition-transform duration-300 ${
                  isTerms ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </Link>
          </nav>

          <span className="mx-3 hidden h-5 w-px bg-[#E5EAF4] lg:block" />

          {/* Primary Action Button */}
          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            className="group inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#315EFB] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-[#254EDB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315EFB] focus-visible:ring-offset-2"
          >
            {isLoggedIn ? "Dashboard" : "Sign in"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-[#172554] transition-colors hover:bg-[#F7F9FE] lg:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        isLoggedIn={isLoggedIn}
      />
    </header>
  );
}
