import React from "react";
import { Navbar } from "./Navbar";
import { HeroSection } from "./HeroSection";
import { FeaturesSection } from "./FeaturesSection";
import { GeofencingSection } from "./GeofencingSection";
import { CloudBackupSection } from "./CloudBackupSection";
import { SecuritySection } from "./SecuritySection";
import { CTASection } from "./CTASection";
import { Footer } from "./Footer";

export function HomePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFF] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <GeofencingSection />
        <CloudBackupSection />
        <SecuritySection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default HomePage;
