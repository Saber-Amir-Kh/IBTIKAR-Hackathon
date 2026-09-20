import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  color?: string;
}

/**
 * Tactical Optical Scope / Radar Crosshair (Replaces generic folded map)
 * Fits real drone surveillance & optical gimbal feed
 */
export const RadarScopeIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Outer scope circle */}
    <circle cx="12" cy="12" r="9.5" />
    {/* Inner reticle */}
    <circle cx="12" cy="12" r="4.5" strokeDasharray="2.5 2" />
    {/* Tactical crosshair axis */}
    <line x1="12" y1="2" x2="12" y2="6.5" />
    <line x1="12" y1="17.5" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6.5" y2="12" />
    <line x1="17.5" y1="12" x2="22" y2="12" />
    {/* Center optical dot */}
    <circle cx="12" cy="12" r="1.3" fill={color} stroke="none" />
  </svg>
);

/**
 * Touiza Emergency Dispatch / Crisis Relief Kit (Replaces generic cardboard parcel box)
 * Symbolizes emergency logistics, first-response tools & community supply mobilization
 */
export const TouizaReliefIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Tactical Case Box */}
    <rect x="2.5" y="7" width="19" height="13.5" rx="2.5" />
    {/* Handle */}
    <path d="M8.5 7V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V7" />
    {/* Emergency Aid Cross */}
    <line x1="12" y1="10.5" x2="12" y2="16.5" strokeWidth="2.2" />
    <line x1="9" y1="13.5" x2="15" y2="13.5" strokeWidth="2.2" />
  </svg>
);

/**
 * Ecological Reforestation / Biomass Restoration (Replaces generic clipart pine tree)
 * Combines organic endemic canopy leaf with precision parcel grid lines
 */
export const EcoParcelIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {/* Endemic Cedar / Leaf Form */}
    <path d="M12 2.5C9 6 6 8.5 6 13a6 6 0 0 0 12 0c0-4.5-3-7-6-10.5z" />
    {/* Inner veins / growth axis */}
    <path d="M12 7v10" />
    <path d="M9.5 12l2.5 2 2.5-2" />
    {/* Ground / GIS Parcel Baseline */}
    <path d="M3.5 21.5h17" strokeWidth="1.5" strokeDasharray="3 2" />
  </svg>
);

/**
 * Simulation Pulse / Tactical Signal
 */
export const SimPulseIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="2 12 6 12 9 4 15 20 18 12 22 12" />
  </svg>
);

/**
 * Back / Portal Exit Arrow
 */
export const PortalReturnIcon: React.FC<IconProps> = ({ size = 16, className = '', color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

/**
 * Volunteer Brigade / Team Alliance
 */
export const BrigadeIcon: React.FC<IconProps> = ({ size = 18, className = '', color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
