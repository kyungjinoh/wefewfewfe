import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { FlaskConical } from 'lucide-react';
import './HeroSection.css';

const HeroSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSignIn = () => {
    navigate('/signin');
  };

  const handleDashboard = () => {
    window.scrollTo(0, 0);
    navigate('/dashboard');
  };

  return (
    <section className="hero-section" id="hero" aria-labelledby="hero-title">
      <div className="hero-content">
        <h1 id="hero-title">Track, Analyze, and Diagnose Allergies</h1>
        <p className="hero-subheadline">
        AllerGen AI systematically track symptoms and exposures to potential allergens before testing. <br></br>Accurate, accessible, and faster!

        </p>
        <div className="hero-ctas">
          <a href="#upload" className="btn btn-primary">Begin Analysis</a>
          {user ? (
            <button className="btn btn-dashboard" onClick={handleDashboard}>Dashboard</button>
          ) : (
            <button className="btn btn-signup" onClick={handleSignIn}>Sign In</button>
          )}
        </div>
      </div>
      <div className="hero-illustration" aria-hidden="true">
        {/* Replaced Clinical Analysis card with image */}
        <img 
          src="https://images.pexels.com/photos/3807629/pexels-photo-3807629.jpeg" 
          alt="Medical professionals analyzing food ingredients" 
          className="hero-image-replacement"
          style={{
            maxWidth: '600px',
            width: '100%',
            borderRadius: '18px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
            objectFit: 'cover',
            background: 'white',
            border: '1px solid rgba(255,255,255,0.25)',
            display: 'none'
          }}
        />
      </div>
    </section>
  );
};

export default HeroSection; 