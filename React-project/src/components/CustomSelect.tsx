import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeColor?: string;
  sublabel?: string;
}

interface CustomSelectProps {
  value: string | number;
  options: SelectOption[];
  onChange: (value: any) => void;
  placeholder?: string;
  className?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner...',
  className = '',
  icon,
  disabled = false,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string | number) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-container ${size === 'sm' ? 'custom-select-sm' : ''} ${className} ${
        disabled ? 'custom-select-disabled' : ''
      }`}
    >
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="custom-select-trigger-content">
          {icon && <span className="custom-select-leading-icon">{icon}</span>}
          {selectedOption?.icon && (
            <span className="custom-select-leading-icon">{selectedOption.icon}</span>
          )}
          <span className={`custom-select-label ${!selectedOption ? 'placeholder' : ''}`}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className="custom-select-badge"
              style={{
                backgroundColor: selectedOption.badgeColor
                  ? `${selectedOption.badgeColor}22`
                  : 'rgba(255,255,255,0.1)',
                color: selectedOption.badgeColor || '#fff',
                borderColor: selectedOption.badgeColor
                  ? `${selectedOption.badgeColor}44`
                  : 'rgba(255,255,255,0.2)',
              }}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={size === 'sm' ? 14 : 16}
          className={`custom-select-chevron ${isOpen ? 'rotate' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="custom-select-dropdown" role="listbox">
          <div className="custom-select-options-list">
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={String(opt.value)}
                  className={`custom-select-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="custom-select-option-content">
                    {opt.icon && <span className="custom-select-option-icon">{opt.icon}</span>}
                    <div className="custom-select-option-texts">
                      <div className="custom-select-option-label-row">
                        <span className="custom-select-option-title">{opt.label}</span>
                        {opt.badge && (
                          <span
                            className="custom-select-badge"
                            style={{
                              backgroundColor: opt.badgeColor
                                ? `${opt.badgeColor}22`
                                : 'rgba(255,255,255,0.1)',
                              color: opt.badgeColor || '#fff',
                              borderColor: opt.badgeColor
                                ? `${opt.badgeColor}44`
                                : 'rgba(255,255,255,0.2)',
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <span className="custom-select-option-sublabel">{opt.sublabel}</span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={14} className="custom-select-check-icon text-cyan" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
