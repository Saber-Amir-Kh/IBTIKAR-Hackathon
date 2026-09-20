import React, { useState } from 'react';
import '../LandingPage.css';

interface LandingPageProps {
  onEnterPlatform: () => void;
}

// 4-propeller clover logo from Figma
const DroneLogoIcon: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="23" cy="23" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="41" cy="23" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="23" cy="41" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="41" cy="41" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="23" cy="23" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="41" cy="23" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="23" cy="41" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="41" cy="41" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="32" cy="32" r="3.2" fill="#FCF8F6" />
  </svg>
);

// Target / Crosshair corner markers (CIBLE ASSET)
const TargetCorners: React.FC = () => (
  <>
    <div className="cible-corner cible-top-left">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
    <div className="cible-corner cible-top-right">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
    <div className="cible-corner cible-bottom-left">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
    <div className="cible-corner cible-bottom-right">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
  </>
);

interface FaqItemData {
  id: number;
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItemData[] = [
  {
    id: 1,
    question: "How does the autonomous drone detection work?",
    answer: "Our drones patrol high-risk forest zones and continuously process optical feeds using computer vision and edge AI. When fire or smoke is sustained for consecutive frames, an instant geolocated detection alert is dispatched to local crisis coordinators."
  },
  {
    id: 2,
    question: "What is the Tajmaât community verification process?",
    answer: "Every AI detection is immediately submitted to the village assembly (Tajmaât) committee head for rapid verification. Confirmed incidents trigger structured bilingual safety bulletins with wind direction and safe containment zones, preventing panic."
  },
  {
    id: 3,
    question: "How does the Touiza mutual aid board coordinate volunteers?",
    answer: "The platform hosts a live mutual aid board where coordinators post critical resource needs (water packs, fire-break tools, masks). Nearby volunteers claim exactly what they can provide with automated server-side anti-overclaiming protection."
  },
  {
    id: 4,
    question: "How are post-wildfire reforestation zones tracked?",
    answer: "Once a fire is contained, the platform partitions the burned perimeter into 5 monitored parcels. Eco-clubs and volunteer brigades log planted endemic trees (cedar, oak, pine), and the interactive map dynamically transitions from scorched earth brown to forest green."
  }
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterPlatform }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'about' | 'faq' | 'showcase' | 'contact'>('home');
  const [openFaqId, setOpenFaqId] = useState<number | null>(1);

  const scrollToSection = (id: string, tab: typeof activeTab) => {
    setActiveTab(tab);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="figma-landing-container">
      {/* 1. Navigation Bar (Frame 31 / Frame 32) */}
      <header className="figma-navbar">
        <button className="figma-logo-wrap" onClick={() => scrollToSection('hero-section', 'home')}>
          <DroneLogoIcon size={36} />
        </button>

        <nav>
          <ul className="figma-nav-links">
            <li className="figma-nav-item">
              <a
                className={`figma-nav-link ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => scrollToSection('hero-section', 'home')}
              >
                Home
              </a>
            </li>
            <li className="figma-nav-item">
              <a
                className={`figma-nav-link ${activeTab === 'about' ? 'active' : ''}`}
                onClick={() => scrollToSection('about-section', 'about')}
              >
                About us
              </a>
            </li>
            <li className="figma-nav-item">
              <a
                className={`figma-nav-link ${activeTab === 'faq' ? 'active' : ''}`}
                onClick={() => scrollToSection('faq-section', 'faq')}
              >
                FAQ
              </a>
            </li>
            <li className="figma-nav-item">
              <a
                className={`figma-nav-link ${activeTab === 'showcase' ? 'active' : ''}`}
                onClick={() => scrollToSection('showcase-section', 'showcase')}
              >
                Showcase
              </a>
            </li>
            <li className="figma-nav-item">
              <a
                className={`figma-nav-link ${activeTab === 'contact' ? 'active' : ''}`}
                onClick={() => scrollToSection('contact-section', 'contact')}
              >
                Contact us
              </a>
            </li>
          </ul>
        </nav>

        <button className="btn-cta-nav" onClick={onEnterPlatform}>
          Join Us
        </button>
      </header>

      {/* 2. Hero Section */}
      <section id="hero-section" className="figma-hero-section">
        <div className="hero-ambient-light" />

        <div className="hero-title-wrap">
          <h1 className="hero-h1-future">THE FUTURE OF</h1>
          <h1 className="hero-h1-fire">FIRE DETECTION</h1>
        </div>

        <div className="hero-drone-stage">
          <img
            src="/assets/drone-hero.png"
            alt="Sentinelle Wildfire Drone"
            className="hero-drone-img"
          />
          <div className="hero-drone-shadow-platform" />
        </div>

        <div className="hero-cta-group">
          <button className="btn-hero-primary" onClick={onEnterPlatform}>
            Join Us
          </button>
          <button className="btn-hero-secondary" onClick={() => scrollToSection('about-section', 'about')}>
            See More
          </button>
        </div>
      </section>

      {/* 3. About Us Section */}
      <section id="about-section" className="figma-about-section">
        <div className="about-ambient-glow" />

        <div className="about-content-left">
          <h2 className="about-title">Wildfire monitoring drone</h2>
          <p className="about-text">
            Our project combines <strong>drone technology</strong> and a <strong>digital volunteering</strong> platform to detect environmental emergencies, coordinate nearby volunteers for safe assistance, and support post-emergency recovery.
          </p>
        </div>

        <div className="about-media-right">
          <img
            src="/assets/drone-about.png"
            alt="Monitoring Drone Side View"
            className="about-drone-img"
          />
        </div>
      </section>

      {/* 4. Showcase / Technical Section ("Innovative Solution") */}
      <section id="showcase-section" className="figma-showcase-section">
        <div className="showcase-word-innovative">Innovative</div>

        <div className="showcase-blueprint-wrap">
          <img
            src="/assets/drone-blueprint.png"
            alt="Drone Blueprint Architecture"
            className="showcase-blueprint-img"
          />
        </div>

        <div className="showcase-word-solution">Solution</div>
      </section>

      {/* 5. FAQ Section */}
      <section id="faq-section" className="figma-faq-section">
        <h2 className="faq-title">Answers To Your Questions</h2>

        <div className="faq-list">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openFaqId === item.id;
            return (
              <div
                key={item.id}
                className={`faq-card ${isOpen ? 'open' : ''}`}
                onClick={() => setOpenFaqId(isOpen ? null : item.id)}
              >
                <TargetCorners />
                <div className="faq-question-row">
                  <h3 className="faq-question-text">{item.question}</h3>
                  <span className="faq-toggle-icon">{isOpen ? '×' : '+'}</span>
                </div>
                {isOpen && (
                  <div className="faq-answer-block">
                    <p className="faq-answer-text">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. Footer / Contact Section */}
      <footer id="contact-section" className="figma-footer-section">
        <div className="footer-content-grid">
          {/* Column 1: Navigate */}
          <div>
            <h4 className="footer-col-header">NAVIGATE</h4>
            <ul className="footer-col-links">
              <li><a className="footer-col-link" onClick={() => scrollToSection('hero-section', 'home')}>Home</a></li>
              <li><a className="footer-col-link" onClick={() => scrollToSection('about-section', 'about')}>About Us</a></li>
              <li><a className="footer-col-link" onClick={() => scrollToSection('faq-section', 'faq')}>FAQ</a></li>
              <li><a className="footer-col-link" onClick={() => scrollToSection('showcase-section', 'showcase')}>Showcase</a></li>
              <li><a className="footer-col-link" onClick={() => scrollToSection('contact-section', 'contact')}>Contact Us</a></li>
            </ul>
          </div>

          {/* Column 2: Socials */}
          <div>
            <h4 className="footer-col-header">SOCIALS</h4>
            <ul className="footer-col-links">
              <li><a className="footer-col-link" href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
              <li><a className="footer-col-link" href="https://linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a></li>
              <li><a className="footer-col-link" href="https://github.com" target="_blank" rel="noreferrer">Github</a></li>
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h4 className="footer-col-header">CONTACT</h4>
            <ul className="footer-col-links">
              <li>
                <a className="footer-col-link" href="mailto:contact@sentinelle-algerie.dz">
                  contact@sentinelle-algerie.dz
                </a>
              </li>
              <li>
                <span className="footer-col-link" style={{ color: '#8c8c8c' }}>
                  Algiers, Algeria — IBTIKAR 2026
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Logo + Copyright */}
        <div className="footer-bottom-bar">
          <DroneLogoIcon size={30} />
          <span className="footer-copyright">© All Rights Reserved</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
