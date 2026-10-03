import HomeNavbar from "../../components/home/HomeNavbar";
import HeroSection from "../../components/home/HeroSection";
import FeatureCards from "../../components/home/FeatureCards";
import HowItWorks from "../../components/home/HowItWorks";
import ImpactCTA from "../../components/home/ImpactCTA";
import HomeFooter from "../../components/home/HomeFooter";
import "./HomePage.css";

export default function HomePage() {
  return (
    <div className="home-page">
      <HomeNavbar />
      <main id="main-content">
        <HeroSection />
        <FeatureCards />
        <HowItWorks />
        <ImpactCTA />
      </main>
      <HomeFooter />
    </div>
  );
}
