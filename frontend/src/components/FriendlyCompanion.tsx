import React from 'react';

const FriendlyCompanion: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`friendly-companion ${className}`}>
    <svg viewBox="0 0 180 180" className="w-full h-auto" aria-hidden="true">
      <defs>
        <linearGradient id="companionGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#f7d6ff" />
        </linearGradient>
      </defs>
      <rect x="20" y="24" width="140" height="132" rx="48" fill="url(#companionGradient)" />
      <circle cx="68" cy="78" r="10" fill="#fff" opacity="0.95" />
      <circle cx="112" cy="78" r="10" fill="#fff" opacity="0.95" />
      <path d="M62 116C74 130 106 130 118 116" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" />
      <circle cx="44" cy="42" r="20" fill="#fef3c7" opacity="0.9" />
      <circle cx="136" cy="40" r="16" fill="#c7f9d9" opacity="0.9" />
      <circle cx="118" cy="138" r="14" fill="#fdedd5" opacity="0.9" />
    </svg>
  </div>
);

export default FriendlyCompanion;
