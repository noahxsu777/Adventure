import PropTypes from 'prop-types';
import { useTheme } from '../context/ThemeContext';

const Spinner = ({ size = 40, color }) => {
  const { theme } = useTheme();
  const spinnerColor = color || theme.colors.secondary;

  const spinnerStyles = {
    display: 'inline-block',
    width: size,
    height: size,
    border: `4px solid ${theme.colors.border}`,
    borderTop: `4px solid ${spinnerColor}`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={spinnerStyles} aria-label="Loading..." />
    </>
  );
};

Spinner.propTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
};

const LoadingOverlay = ({ isLoading, children, message = 'Loading...' }) => {
  const { theme } = useTheme();

  if (!isLoading) return children;

  const overlayStyles = {
    position: 'relative',
    minHeight: '200px',
  };

  const loadingContainerStyles = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    opacity: 0.9,
    zIndex: 10,
  };

  const messageStyles = {
    marginTop: '16px',
    color: theme.colors.text,
    fontSize: '14px',
  };

  return (
    <div style={overlayStyles}>
      {children}
      <div style={loadingContainerStyles}>
        <Spinner />
        <p style={messageStyles}>{message}</p>
      </div>
    </div>
  );
};

LoadingOverlay.propTypes = {
  isLoading: PropTypes.bool.isRequired,
  children: PropTypes.node,
  message: PropTypes.string,
};

export { Spinner, LoadingOverlay };
