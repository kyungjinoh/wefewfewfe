import React from 'react';
import { ClipboardList, BarChart3 } from 'lucide-react';
import { UserCheck } from 'lucide-react';
import './HowItWorks.css';

const steps = [
  {
    icon: <ClipboardList size={36} />,
    title: 'Comprehensive exposure tracking',
    desc: (
      <span className="left-align-step-desc">
        A unified platform for logging:
        <ul>
          <li>Food intake</li>
          <li>Cosmetic/product use</li>
          <li>Medication history</li>
          <li>Environmental exposures</li>
        </ul>
        <em>All data encrypted and HIPAA-compliant</em>
      </span>
    )
  },
  {
    icon: <BarChart3 size={36} />,
    title: 'Evidence-based pattern analysis',
    desc: (
      <span className="left-align-step-desc">
        Proprietary AI algorithm:
        <ul>
          <li>Correlates exposures with symptom timelines</li>
          <li>Identifies probable triggers using clinical databases</li>
          <li>Flags potential cross-reactivities</li>
        </ul>
      </span>
    )
  },
  {
    icon: <UserCheck size={36} />,
    title: 'Clinician-ready reports',
    desc: (
      <span className="left-align-step-desc">
        Automatically generated reports include:
        <ul>
          <li>Chronological symptom logs</li>
          <li>Suspected allergen prioritization</li>
          <li>Visual exposure-symptom mapping</li>
        </ul>
        <em>Export as PDF for EHR integration</em>
      </span>
    )
  }
];

const HowItWorks: React.FC = () => (
  <section className="how-it-works" id="how-it-works" aria-labelledby="how-title">
    <h2 id="how-title">Improve pre-test clarity. Reduce uncertainty.</h2>
    <div className="steps">
      {steps.map((step, idx) => (
        <div className="step" key={step.title}>
          <div className="step-icon" aria-hidden="true">{step.icon}</div>
          <h3 className="step-title">{step.title}</h3>
          <p className="step-desc">{step.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

export default HowItWorks; 