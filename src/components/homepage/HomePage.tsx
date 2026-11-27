import React from "react";
import "./landing.css";
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
    <div className="fp-landing min-h-screen overflow-x-clip bg-[#F7F9FE] text-[#64748B] font-sans selection:bg-[#EDEBFF] selection:text-[#172554]">
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
