import PropTypes from 'prop-types';
import { forwardRef } from 'react';
import { useTheme } from '../context/ThemeContext';

const Input = forwardRef(({ 
  label,
  name,
  type = 'text',
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  required = false,
  disabled = false,
  fullWidth = false,
  icon = null,
  ...props 
}, ref) => {
  const { theme } = useTheme();

  const containerStyles = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: fullWidth ? '100%' : 'auto',
    marginBottom: '16px',
  };

  const labelStyles = {
    fontSize: '14px',
    fontWeight: '500',
    color: theme.colors.text,
  };

  const inputWrapperStyles = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyles = {
    width: '100%',
    padding: icon ? '12px 12px 12px 40px' : '12px',
    fontSize: '16px',
    border: `1px solid ${error ? '#dc3545' : theme.colors.border}`,
    borderRadius: '8px',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
  };

  const iconStyles = {
    position: 'absolute',
    left: '12px',
    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280',
    pointerEvents: 'none',
  };

  const helperStyles = {
    fontSize: '12px',
    color: error ? '#dc3545' : theme.isDarkMode ? '#a0a0a0' : '#6b7280',
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label htmlFor={name} style={labelStyles}>
          {label} {required && <span style={{ color: '#dc3545' }}>*</span>}
        </label>
      )}
      <div style={inputWrapperStyles}>
        {icon && <span style={iconStyles}>{icon}</span>}
        <input
          ref={ref}
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          style={inputStyles}
          {...props}
        />
      </div>
      {(helperText || error) && (
        <span style={helperStyles}>{error || helperText}</span>
      )}
    </div>
  );
});

Input.displayName = 'Input';

Input.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  type: PropTypes.string,
  placeholder: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  onBlur: PropTypes.func,
  error: PropTypes.string,
  helperText: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  fullWidth: PropTypes.bool,
  icon: PropTypes.node,
};

export default Input;
