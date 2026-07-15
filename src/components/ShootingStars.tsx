import React from 'react';

export default function ShootingStars() {
  return (
    <div className="shooting-star-container pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 15 }}>
      <div className="shooting-star"></div>
      <div className="shooting-star"></div>
      <div className="shooting-star"></div>
      <div className="shooting-star"></div>
      <div className="shooting-star"></div>
    </div>
  );
}
