import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { User, LogOut, LayoutDashboard, ChevronDown, ExternalLink } from 'lucide-react';
import './Header.css';

const isMobile = () => window.innerWidth <= 768;

const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isMobileView, setIsMobileView] = useState(isMobile());
  const desktopUserMenuRef = useRef<HTMLDivElement>(null);

  // Check if we're on the main page
  const isMainPage = location.pathname === '/';

  // Close dropdown on route change
  useEffect(() => {
    setShowUserMenu(false);
  }, [location.pathname]);

  // Click outside for desktop dropdown only when open
  useEffect(() => {
    if (!showUserMenu || isMobileView) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (desktopUserMenuRef.current && !desktopUserMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu, isMobileView]);

  useEffect(() => {
    const handleResize = () => setIsMobileView(isMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleSignIn = () => {
    closeMenu();
    navigate('/signin');
  };

  const handleLogoClick = () => {
    closeMenu();
    navigate('/');
    window.scrollTo(0, 0);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
      closeMenu();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDashboard = () => {
    setShowUserMenu(false);
    closeMenu();
    window.scrollTo(0, 0);
    navigate('/dashboard');
  };

  const handleProfile = () => {
    setShowUserMenu(false);
    closeMenu();
    window.scrollTo(0, 0);
    navigate('/profile');
  };

  const handleQuickDashboard = () => {
    closeMenu();
    window.scrollTo(0, 0);
    navigate('/dashboard');
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-logo">
          <button onClick={handleLogoClick} className="logo-button" style={{display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer'}}>
            <img src={require('./A_logo_in_vector_graphic_format_is_displayed_on_a_-removebg-preview (1).png')} alt="AllerGen AI Logo" style={{height: '2.8rem', width: '2.8rem', objectFit: 'contain', marginRight: '0.5rem', display: 'inline-block', verticalAlign: 'middle'}} />
            <span style={{fontSize: '1.7rem', fontWeight: 700, letterSpacing: '0.03em', color: '#1e40af', display: 'inline-block', verticalAlign: 'middle'}}>AllerGen AI</span>
          </button>
        </div>
        
        <nav className={`header-nav ${isMenuOpen ? 'nav-open' : ''}`}>
          {isMainPage && (
            <>
              <a href="#upload" onClick={closeMenu} className="nav-highlight">Begin Analysis</a>
              <a href="#how-it-works" onClick={closeMenu}>Features</a>
              <a href="#pricing" onClick={closeMenu}>Pricing</a>
              <a href="#testimonials" onClick={closeMenu}>Validation</a>
            </>
          )}
          {user ? (
            isMobileView ? (
              <>
                <button className="mobile-dashboard-menu-button" onClick={handleDashboard}>
                  <LayoutDashboard /> Dashboard
                </button>
                <button className="mobile-profile-menu-button" onClick={handleProfile}>
                  <User /> Profile
                </button>
                <button className="mobile-signout-button" onClick={handleSignOut}>
                  <LogOut /> Sign Out
                </button>
              </>
            ) : (
              <div className="mobile-user-menu-container" ref={userMenuRef}>
                <div className="mobile-user-controls">
                  <button className="mobile-user-menu-button" onClick={toggleUserMenu}>
                    <User />
                    <span>{user.displayName || user.email}</span>
                    <span className={`dropdown-arrow ${showUserMenu ? 'rotated' : ''}`}>
                      <ChevronDown />
                    </span>
                  </button>
                  <button className="mobile-quick-dashboard-button" onClick={handleQuickDashboard} title="Go to Dashboard">
                    <ExternalLink />
                  </button>
                </div>
                {showUserMenu && (
                  <div className="mobile-user-menu">
                    <div className="mobile-user-info">
                      <strong>{user.displayName || 'User'}</strong>
                      <span>{user.email}</span>
                    </div>
                    <button className="mobile-dashboard-menu-button" onClick={handleDashboard}>
                      <LayoutDashboard /> Dashboard
                    </button>
                    <button className="mobile-profile-menu-button" onClick={handleProfile}>
                      <User /> Profile
                    </button>
                    <button className="mobile-signout-button" onClick={handleSignOut}>
                      <LogOut /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            <button className="mobile-signup-btn" onClick={handleSignIn}>Sign In</button>
          )}
        </nav>

        <div className="header-actions">
          {user ? (
            <div className="user-menu-container" ref={desktopUserMenuRef}>
              <div className="user-controls">
                <button className="user-menu-button" onClick={toggleUserMenu}>
                  <User />
                  <span>{user.displayName || user.email}</span>
                  <span className={`dropdown-arrow ${showUserMenu ? 'rotated' : ''}`}>
                    <ChevronDown />
                  </span>
                </button>
                <button className="quick-dashboard-button" onClick={handleQuickDashboard} title="Go to Dashboard">
                  <ExternalLink />
                </button>
              </div>
              {showUserMenu && (
                <div className="user-menu">
                  <div className="user-info">
                    <strong>{user.displayName || 'User'}</strong>
                    <span>{user.email}</span>
                  </div>
                  <button className="dashboard-menu-button" onClick={handleDashboard}>
                    <LayoutDashboard />
                    Dashboard
                  </button>
                  <button className="profile-menu-button" onClick={handleProfile}>
                    <User />
                    Profile
                  </button>
                  <button className="signout-button" onClick={handleSignOut}>
                    <LogOut />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="signup-btn" onClick={handleSignIn}>Sign In</button>
          )}
        </div>

        <button 
          className={`hamburger ${isMenuOpen ? 'active' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle navigation menu"
          aria-expanded={isMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </header>
  );
};

export default Header; 