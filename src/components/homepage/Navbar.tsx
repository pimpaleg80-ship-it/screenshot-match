import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, X } from "lucide-react";
import { FlowPeopleLogo } from "./FlowPeopleLogo";
import { MobileMenu } from "./MobileMenu";
import { useSession } from "@/hooks/use-session";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);

  // Scroll spy effect using IntersectionObserver
  useEffect(() => {
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
  }, []);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      id="top"
      className="sticky top-0 z-40 border-b border-slate-200 bg-white"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <FlowPeopleLogo />

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Desktop Navigation */}
          <nav className="hidden items-center lg:flex" aria-label="Primary Navigation">
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, "features")}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                activeSection === "features" ? "text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Features
              <span
                className={`absolute inset-x-3 -bottom-[19px] h-0.5 bg-indigo-600 transition-transform duration-300 ${
                  activeSection === "features" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <a
              href="#geofencing"
              onClick={(e) => scrollToSection(e, "geofencing")}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                activeSection === "geofencing" ? "text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Geofencing
              <span
                className={`absolute inset-x-3 -bottom-[19px] h-0.5 bg-indigo-600 transition-transform duration-300 ${
                  activeSection === "geofencing" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <a
              href="#cloud-backup"
              onClick={(e) => scrollToSection(e, "cloud-backup")}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                activeSection === "cloud-backup" ? "text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Cloud Backup
              <span
                className={`absolute inset-x-3 -bottom-[19px] h-0.5 bg-indigo-600 transition-transform duration-300 ${
                  activeSection === "cloud-backup" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <a
              href="#security"
              onClick={(e) => scrollToSection(e, "security")}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                activeSection === "security" ? "text-slate-900 font-semibold" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Security
              <span
                className={`absolute inset-x-3 -bottom-[19px] h-0.5 bg-indigo-600 transition-transform duration-300 ${
                  activeSection === "security" ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </a>
            <Link
              to="/privacy-policy"
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Terms
            </Link>
          </nav>

          <span className="mx-3 hidden h-5 w-px bg-slate-200 lg:block" />

          {/* Primary Action Button */}
          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            className="group inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            {isLoggedIn ? "Dashboard" : "Sign in"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
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
