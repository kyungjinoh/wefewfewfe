import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { ClipboardList } from 'lucide-react';
import './UploadDemo.css';

const UploadDemo: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if user is logged in
      if (!user) {
        // Redirect to sign in page if not logged in
        navigate('/signin');
      } else {
        // Redirect to dashboard if logged in
        navigate('/dashboard');
      }
    }
  };

  return (
    <section className="upload-demo" id="upload" aria-labelledby="upload-title">
      <h2 id="upload-title" className="highlight-title">Let's Start</h2>
      <div className="demo-container">
        <div className="upload-area" tabIndex={0} role="button" aria-label="Upload ingredient documentation" onClick={handleButtonClick} onKeyPress={e => { if (e.key === 'Enter') handleButtonClick(); }}>
          <div className="upload-icon" aria-hidden="true"><ClipboardList size={36} /></div>
          <div className="upload-title">Upload Documentation</div>
          <div className="upload-desc">Submit ingredient labels for comprehensive allergen assessment</div>
          <button className="upload-btn">Choose File</button>
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            aria-label="Upload ingredient documentation image"
            onChange={handleFileUpload}
          />
        </div>
        
        <div className="results-preview">
          <div className="results-title">Sample Analysis Results</div>
          <div className="result-item">
            <span className="allergen-name">Peanuts</span>
            <span className="allergen-risk risk-high">High Risk</span>
          </div>
          <div className="result-item">
            <span className="allergen-name">Tree Nuts</span>
            <span className="allergen-risk risk-medium">Medium Risk</span>
          </div>
          <div className="result-item">
            <span className="allergen-name">Dairy</span>
            <span className="allergen-risk risk-low">Low Risk</span>
          </div>
          <div className="result-item">
            <span className="allergen-name">Soy</span>
            <span className="allergen-risk risk-low">Safe</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UploadDemo; 