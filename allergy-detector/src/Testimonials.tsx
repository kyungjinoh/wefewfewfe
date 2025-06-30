import React from 'react';
import './Testimonials.css';

const testimonials = [
  {
    content: 'This system significantly improved our ability to identify hidden allergens in patient diets, leading to better clinical outcomes.',
    name: 'Dr. Sarah Chen',
    title: 'MD, Allergist'
  },
  {
    content: 'The analytical capabilities provide comprehensive allergen assessment that enhances our clinical decision-making process.',
    name: 'Dr. Michael Rodriguez',
    title: 'PhD, Clinical Researcher'
  },
  {
    content: 'Our practice has seen a 40% reduction in adverse reactions since implementing this advanced detection system.',
    name: 'Dr. Emily Thompson',
    title: 'RD, Clinical Nutritionist'
  }
];

const Testimonials: React.FC = () => (
  <section className="testimonials" id="testimonials" aria-labelledby="testimonials-title">
    <h2 id="testimonials-title">Clinical Validation</h2>
    <div className="testimonial-grid">
      {testimonials.map((t, i) => (
        <div className="testimonial" key={i}>
          <div className="testimonial-content">{t.content}</div>
          <div className="testimonial-author">
            <div className="author-avatar">{t.name.charAt(0)}</div>
            <div className="author-info">
              <div className="author-name">{t.name}</div>
              <div className="author-title">{t.title}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default Testimonials; 