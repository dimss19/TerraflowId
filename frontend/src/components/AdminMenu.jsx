import React, { useState, useRef, useEffect } from 'react';
import { 
  Users, 
  Radio, 
  LogOut, 
  ChevronDown 
} from 'lucide-react';

export default function AdminMenu({ 
  currentUser, 
  onNavigate, 
  onLogout 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isAdmin = currentUser?.role === 'admin';
  const displayName = currentUser?.fullName || currentUser?.username || 'Pengguna';
  const userInitials = (displayName[0] || 'U').toUpperCase();

  const handleMenuClick = (path) => {
    setIsOpen(false);
    onNavigate(path);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      
      {/* Profile Trigger Button - Circular by default, reactively expands to pill when clicked */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isOpen ? '9px' : '0px',
          background: isOpen ? '#eef4fd' : '#f8fafc',
          border: isOpen ? '1.5px solid #003882' : '1.5px solid #e2e8f0',
          padding: isOpen ? '4px 12px 4px 4px' : '4px',
          borderRadius: isOpen ? '24px' : '50%',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
          boxShadow: isOpen ? '0 2px 10px rgba(0, 56, 130, 0.12)' : 'none',
          height: '38px',
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={isOpen ? 'Tutup menu' : `Akun: ${displayName} (${isAdmin ? 'Admin' : 'Operator'})`}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#003882';
            e.currentTarget.style.background = '#edf2fc';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#e2e8f0';
            e.currentTarget.style.background = '#f8fafc';
          }
        }}
      >
        {/* Avatar */}
        {currentUser?.avatarUrl ? (
          <img 
            src={currentUser.avatarUrl} 
            alt={displayName} 
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
          />
        ) : (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#003882',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 800,
            flexShrink: 0
          }}>
            {userInitials}
          </div>
        )}

        {/* User Info - Reactively expands on click */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
          maxWidth: isOpen ? '240px' : '0px',
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          transition: 'max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          pointerEvents: isOpen ? 'auto' : 'none'
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
            {displayName}
          </span>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            color: isAdmin ? '#003882' : '#059669',
            textTransform: 'uppercase'
          }}>
            {currentUser?.role || 'Operator'}
          </span>
        </div>

        {/* Chevron - Reactively expands on click */}
        <div style={{
          maxWidth: isOpen ? '18px' : '0px',
          opacity: isOpen ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          display: 'flex',
          alignItems: 'center'
        }}>
          <ChevronDown 
            size={14} 
            color="#64748b" 
            style={{ 
              transition: 'transform 0.2s', 
              transform: isOpen ? 'rotate(180deg)' : 'none',
              flexShrink: 0
            }} 
          />
        </div>
      </button>

      {/* Dropdown Menu Modal / Popover */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '240px',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 12px 32px rgba(0, 56, 130, 0.12)',
          zIndex: 1000,
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          
          {/* User Header Summary inside Dropdown */}
          <div style={{ padding: '14px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
              {displayName}
            </div>
            <div style={{ fontSize: '0.74rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.email || `@${currentUser?.username}`}
            </div>
          </div>

          <div style={{ padding: '6px' }}>
            
            {/* Admin-only Items */}
            {isAdmin && (
              <>
                <button
                  onClick={() => handleMenuClick('/admin/users')}
                  className="dropdown-item"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Users size={16} color="#003882" />
                  <span>Kelola Pengguna</span>
                </button>

                <button
                  onClick={() => handleMenuClick('/admin/devices')}
                  className="dropdown-item"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    border: 'none',
                    background: 'transparent',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: '#1e293b',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Radio size={16} color="#003882" />
                  <span>Kelola Perangkat</span>
                </button>

                <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 8px' }} />
              </>
            )}

            {/* General Items */}
            <button
              onClick={() => {
                setIsOpen(false);
                onLogout();
              }}
              className="dropdown-item"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#dc2626',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <LogOut size={16} color="#dc2626" />
              <span>Keluar (Logout)</span>
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
