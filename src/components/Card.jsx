import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext';

const Card = ({ 
  children, 
  title, 
  subtitle,
  footer,
  onClick,
  hoverable = false,
  bordered = true,
  shadow = true,
  padding = 'medium',
  ...props 
}) => {
  const { theme } = useTheme();

  const paddingSizes = {
    none: '0',
    small: '12px',
    medium: '20px',
    large: '28px',
  };

  const cardStyles = {
    backgroundColor: theme.colors.card,
    borderRadius: '12px',
    border: bordered ? `1px solid ${theme.colors.border}` : 'none',
    boxShadow: shadow ? '0 4px 6px rgba(0, 0, 0, 0.1)' : 'none',
    transition: 'all 0.3s ease',
    cursor: onClick ? 'pointer' : 'default',
    overflow: 'hidden',
    transform: hoverable ? 'translateY(0)' : undefined,
  };

  const headerStyles = {
    padding: paddingSizes[padding],
    borderBottom: title || subtitle ? `1px solid ${theme.colors.border}` : 'none',
  };

  const bodyStyles = {
    padding: paddingSizes[padding],
  };

  const footerStyles = {
    padding: paddingSizes[padding],
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.isDarkMode ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.02)',
  };

  const titleStyles = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: theme.colors.text,
    margin: '0 0 4px 0',
  };

  const subtitleStyles = {
    fontSize: '0.875rem',
    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280',
    margin: 0,
  };

  return (
    <div 
      style={cardStyles}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          onClick(e);
        }
      }}
      {...props}
    >
      {(title || subtitle) && (
        <div style={headerStyles}>
          {title && <h3 style={titleStyles}>{title}</h3>}
          {subtitle && <p style={subtitleStyles}>{subtitle}</p>}
        </div>
      )}
      <div style={bodyStyles}>{children}</div>
      {footer && <div style={footerStyles}>{footer}</div>}
    </div>
  );
};

Card.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  footer: PropTypes.node,
  onClick: PropTypes.func,
  hoverable: PropTypes.bool,
  bordered: PropTypes.bool,
  shadow: PropTypes.bool,
  padding: PropTypes.oneOf(['none', 'small', 'medium', 'large']),
};

export default Card;
