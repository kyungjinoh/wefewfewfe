import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import Header from './Header';
import './SignUp.css';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from 'firebase/auth';

const SignUp: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: name });
      }
      setSuccess(true);
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Sign up error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please sign in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please choose a stronger password.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Authentication service is not properly configured. Please contact support.');
      } else {
        setError(err.message || 'Failed to sign up. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setSuccess(true);
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Google sign up error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign up was cancelled. Please try again.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Pop-up was blocked. Please allow pop-ups for this site and try again.');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Authentication service is not properly configured. Please contact support.');
      } else {
        setError(err.message || 'Google sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToHome = () => {
    navigate('/');
  };

  const handleSignIn = () => {
    navigate('/signin');
  };

  return (
    <>
      <Header />
      <div className="signup-container">
        <div className="signup-background">
          <div className="signup-overlay"></div>
        </div>
        <div className="signup-content">
          <div className="signup-card">
            <div className="signup-header">
              <img src={require('./A_logo_in_vector_graphic_format_is_displayed_on_a_-removebg-preview (1).png')} alt="AllergyGen AI Logo" style={{height: '2.5rem', width: '2.5rem', objectFit: 'contain', marginBottom: '0.5rem'}} />
              <h1>AllergyGen AI</h1>
              <p>Create your clinical account</p>
            </div>
            <form className="signup-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <div className="input-container">
                  <div className="input-icon">
                    <User />
                  </div>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
              </div>
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
                    placeholder="Create a password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <div className="input-container">
                  <div className="input-icon">
                    <Lock />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>
              <button type="submit" className="signup-button" disabled={loading}>
                {loading ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>
            {error && <div className="auth-error" role="alert">{error}</div>}
            {success && <div className="auth-success">Sign up successful! Redirecting...</div>}
            <div className="divider">
              <span>or</span>
            </div>
            <button type="button" className="google-signup-button" onClick={handleGoogleSignUp} disabled={loading}>
              <span className="google-icon">
                {FcGoogle({ size: 24 })}
              </span>
              Sign up with Google
            </button>
            <div className="signup-footer">
              <p>Already have an account? <button onClick={handleSignIn} className="footer-link">Sign In</button></p>
              <button onClick={handleBackToHome} className="back-to-home">← Back to Home</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUp; 