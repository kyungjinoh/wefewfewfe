import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import Header from './Header';
import './SignIn.css';
import { auth } from './firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from 'firebase/auth';

const SignIn: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Sign in error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please sign up first.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Authentication service is not properly configured. Please contact support.');
      } else {
        setError(err.message || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign in was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked. Please allow pop-ups for this site and try again.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Authentication service is not properly configured. Please contact support.');
      } else {
        setError(err.message || 'Google sign in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResetSent(false);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  return (
    <>
      <Header />
      <div className="signin-container">
        <div className="signin-background">
          <div className="signin-overlay"></div>
        </div>
        
        <div className="signin-content">
          <div className="signin-card">
            <div className="signin-header">
              <img src={require('./A_logo_in_vector_graphic_format_is_displayed_on_a_-removebg-preview (1).png')} alt="AllergyGen AI Logo" style={{height: '2.5rem', width: '2.5rem', objectFit: 'contain', marginBottom: '0.5rem'}} />
              <h1>AllergyGen AI</h1>
              <p>Sign in to your clinical account</p>
            </div>

            <form className="signin-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-container">
                  <div className="input-icon">
                    <Mail />
                  </div>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-container">
                  <div className="input-icon">
                    <Lock />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Remember me
                </label>
                <button type="button" className="forgot-password" onClick={() => setShowForgotModal(true)}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="signin-button" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="divider">
              <span>or</span>
            </div>

            <button type="button" className="google-signin-button" onClick={handleGoogleSignIn}>
              <span className="google-icon">
                {FcGoogle({ size: 24 })}
              </span>
              Sign in with Google
            </button>

            <div className="signin-footer">
              <p>Don't have an account? <button onClick={() => navigate('/signup')} className="footer-link">Contact your administrator</button></p>
              <button onClick={handleBackToHome} className="back-to-home">← Back to Home</button>
            </div>
          </div>
        </div>
      </div>
      {error && <div className="auth-error" role="alert">{error}</div>}
      {showForgotModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-content">
            <h2>Reset Password</h2>
            <form onSubmit={handleForgotPassword}>
              <label htmlFor="resetEmail">Enter your email address:</label>
              <input
                type="email"
                id="resetEmail"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0', borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <button type="submit" className="signin-button" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>
              <button type="button" className="back-to-home" style={{ marginTop: '1rem' }} onClick={() => { setShowForgotModal(false); setResetEmail(''); setResetSent(false); setError(null); }}>Cancel</button>
              {resetSent && <div style={{ color: '#22c55e', marginTop: '1rem' }}>Reset email sent! Check your inbox.</div>}
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SignIn; 