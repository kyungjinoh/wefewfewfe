import React from 'react';
import { FlaskConical, FileText } from 'lucide-react';
import { Dna } from 'lucide-react';
import './Features.css';

const features = [
  {
    icon: <FlaskConical size={36} />,
    title: 'Advanced OCR Technology',
    desc: 'Precision ingredient extraction utilizing state-of-the-art optical character recognition algorithms.'
  },
  {
    icon: <Dna size={36} />,
    title: 'AI-Powered Analysis',
    desc: 'Machine learning algorithms identify allergen patterns and cross-reactivity with clinical accuracy.'
  },
  {
    icon: <FileText size={36} />,
    title: 'Clinical Documentation',
    desc: 'Comprehensive ingredient verification and manual correction capabilities for medical records.'
  }
];

const Features: React.FC = () => (
  <section className="features" id="features" aria-labelledby="features-title">
    <h2 id="features-title" style={{ fontSize: '3rem', fontWeight: 800, textAlign: 'center', marginBottom: '2rem' }}>
      Data-driven insights that support your care.
    </h2>
    <p style={{
      maxWidth: '900px',
      margin: '0 auto',
      fontSize: '1.5rem',
      color: '#475569',
      textAlign: 'center',
      fontWeight: 400,
      fontFamily: 'Open Sans',
      lineHeight: 1.5
    }}>
      AllerGEN AI enhances clinical efficiency through structured patient-reported data, leveraging evidence-based allergen databases and our cross-reactivity algorithms to deliver precise diagnostic insights and improve patient outcomes.
    </p>
  </section>
);

export default Features; 