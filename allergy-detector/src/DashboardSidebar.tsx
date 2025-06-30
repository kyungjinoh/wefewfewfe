import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const DashboardSidebar: React.FC = () => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button 
        className="mobile-menu-toggle"
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={closeMobileMenu} />
      )}

      {/* Sidebar */}
      <aside className={`dashboard-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <nav>
          <ul>
            <li>
              <Link 
                to="/dashboard" 
                className={location.pathname === '/dashboard' ? 'active' : ''}
                onClick={closeMobileMenu}
              >
                Home
              </Link>
            </li>
            <li>
              <Link 
                to="/dashboard/log-reaction" 
                className={location.pathname === '/dashboard/log-reaction' ? 'active' : ''}
                onClick={closeMobileMenu}
              >
                Log Condition
              </Link>
            </li>
            <li>
              <Link 
                to="/dashboard/analysis" 
                className={location.pathname === '/dashboard/analysis' ? 'active' : ''}
                onClick={closeMobileMenu}
              >
                Analysis
              </Link>
            </li>
            <li>
              <Link 
                to="/dashboard/history" 
                className={location.pathname === '/dashboard/history' ? 'active' : ''}
                onClick={closeMobileMenu}
              >
                History
              </Link>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default DashboardSidebar; 