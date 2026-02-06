import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'medium',
  closeOnOverlay = true,
}) => {
  const { theme } = useTheme();

  if (!isOpen) return null;

  const sizeStyles = {
    small: { maxWidth: '400px' },
    medium: { maxWidth: '600px' },
    large: { maxWidth: '800px' },
    fullscreen: { maxWidth: '100vw', height: '100vh', margin: 0, borderRadius: 0 },
  };

  const overlayStyles = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  };

  const modalStyles = {
    backgroundColor: theme.colors.card,
    borderRadius: '12px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
    width: '100%',
    ...sizeStyles[size],
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const titleStyles = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: theme.colors.text,
    margin: 0,
  };

  const closeButtonStyles = {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: theme.colors.text,
    padding: '4px',
    lineHeight: 1,
  };

  const bodyStyles = {
    padding: '20px',
    overflowY: 'auto',
    flex: 1,
    color: theme.colors.text,
  };

  const footerStyles = {
    padding: '20px',
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  };

  const handleOverlayClick = (e) => {
    if (closeOnOverlay && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      style={overlayStyles} 
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div style={modalStyles}>
        <div style={headerStyles}>
          <h2 id="modal-title" style={titleStyles}>{title}</h2>
          <button 
            style={closeButtonStyles} 
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div style={bodyStyles}>{children}</div>
        {footer && <div style={footerStyles}>{footer}</div>}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  footer: PropTypes.node,
  size: PropTypes.oneOf(['small', 'medium', 'large', 'fullscreen']),
  closeOnOverlay: PropTypes.bool,
};

export default Modal;
