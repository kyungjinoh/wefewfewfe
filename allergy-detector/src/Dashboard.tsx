import React from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FlaskConical, Upload, History, Settings, ClipboardList, BarChart3 } from 'lucide-react';
import Header from './Header';
import './Dashboard.css';
import DashboardSidebar from './DashboardSidebar';
import { useAccessControl } from './hooks/useAccessControl';

const LOGO_URL = "https://cdn.discordapp.com/attachments/1384526031221817375/1386902983828312214/A_logo_in_vector_graphic_format_is_displayed_on_a_-removebg-preview.png?ex=685c0e4e&is=685abcce&hm=18ec9739025d39dcf0033827fdc2a7664367207be46b432df725f279805e39a9&";

const Dashboard: React.FC = () => {
  const { user, hasAccess, isRestrictedRoute } = useAccessControl();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    navigate('/signin');
    return null;
  }

  // Check if user ID is in the allowed list - only for main dashboard route
  if (location.pathname === '/dashboard' && !hasAccess) {
    return (
      <div className="access-denied-container">
        <div className="access-denied-content">
          <h1>Access Denied</h1>
          <p>You do not have permission to access this dashboard.</p>
          <p>User ID: {user.uid}</p>
          <button 
            className="sign-out-button" 
            onClick={() => {
              // Sign out the user
              navigate('/');
            }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <DashboardSidebar />
      <main className="dashboard-main">
        <Header />
        <div className="dashboard-container">
          <div className="dashboard-content">
            <div className="dashboard-header">
              <h1>Welcome, {user.displayName || 'Clinical User'}!</h1>
              <p>Track patterns, update records, and export data for your care team.</p>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card">
                <div className="card-icon"><ClipboardList /></div>
                <h3>Log Condition</h3>
                <p>Log a new allergic condition or symptom to track potential triggers.</p>
                <button className="card-button" onClick={() => navigate('/dashboard/log-reaction')}>
                  Go to Log Condition
                </button>
              </div>

              <div className="dashboard-card">
                <div className="card-icon"><BarChart3 /></div>
                <h3>Analysis</h3>
                <p>Get AI-powered insights into your potential allergens and personalized reports.</p>
                <button className="card-button" onClick={() => navigate('/dashboard/analysis')}>
                  Go to Analysis
                </button>
              </div>

              <div className="dashboard-card">
                <div className="card-icon"><History /></div>
                <h3>History</h3>
                <p>Review your past reactions and allergen analysis history.</p>
                <button className="card-button" onClick={() => navigate('/dashboard/history')}>
                  Go to History
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard; 