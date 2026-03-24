"use client";

import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import FeatureCards from "@/components/landing/FeatureCards";
import StatsBar from "@/components/landing/StatsBar";
import LogoMarquee from "@/components/landing/LogoMarquee";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main className="bg-base">
      <Navbar />
      <Hero />
      <FeatureCards />
      <StatsBar />
      <LogoMarquee />
      <Footer />
    </main>
  );
}
