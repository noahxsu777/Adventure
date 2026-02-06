import { createContext, useContext, useState, useMemo } from 'react';
import PropTypes from 'prop-types';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const theme = useMemo(() => ({
    isDarkMode,
    colors: {
      background: isDarkMode ? '#1a1a2e' : '#ffffff',
      text: isDarkMode ? '#eaeaea' : '#213547',
      primary: isDarkMode ? '#646cff' : '#1a1a2e',
      secondary: isDarkMode ? '#535bf2' : '#747bff',
      card: isDarkMode ? '#16213e' : '#f5f5f5',
      border: isDarkMode ? '#3d3d5c' : '#e0e0e0',
    }
  }), [isDarkMode]);

  const value = useMemo(() => ({
    theme,
    isDarkMode,
    toggleTheme
  }), [theme, isDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
