import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext';

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false,
  type = 'button',
  fullWidth = false,
  loading = false,
  icon = null,
  ...props 
}) => {
  const { theme } = useTheme();

  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    borderRadius: '8px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    opacity: disabled || loading ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
  };

  const sizeStyles = {
    small: { padding: '8px 16px', fontSize: '14px' },
    medium: { padding: '12px 24px', fontSize: '16px' },
    large: { padding: '16px 32px', fontSize: '18px' },
  };

  const variantStyles = {
    primary: {
      backgroundColor: theme.colors.primary,
      color: theme.isDarkMode ? '#ffffff' : '#ffffff',
    },
    secondary: {
      backgroundColor: 'transparent',
      color: theme.colors.text,
      border: `2px solid ${theme.colors.border}`,
    },
    danger: {
      backgroundColor: '#dc3545',
      color: '#ffffff',
    },
    success: {
      backgroundColor: '#28a745',
      color: '#ffffff',
    },
    ghost: {
      backgroundColor: 'transparent',
      color: theme.colors.secondary,
    },
  };

  const styles = {
    ...baseStyles,
    ...sizeStyles[size],
    ...variantStyles[variant],
  };

  return (
    <button
      type={type}
      style={styles}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="spinner">⏳</span>}
      {icon && !loading && <span className="icon">{icon}</span>}
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger', 'success', 'ghost']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  disabled: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  fullWidth: PropTypes.bool,
  loading: PropTypes.bool,
  icon: PropTypes.node,
};

export default Button;
