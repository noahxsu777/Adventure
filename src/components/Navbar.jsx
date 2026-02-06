import { NavLink } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';

const Navbar = () => {
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useUser();

  const navStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    backgroundColor: theme.colors.card,
    borderBottom: `1px solid ${theme.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 100,
  };

  const logoStyles = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: theme.colors.secondary,
    textDecoration: 'none',
  };

  const linkContainerStyles = {
    display: 'flex',
    gap: '24px',
    alignItems: 'center',
  };

  const getLinkStyles = ({ isActive }) => ({
    color: isActive ? theme.colors.secondary : theme.colors.text,
    textDecoration: 'none',
    fontWeight: isActive ? '600' : '400',
    padding: '8px 0',
    borderBottom: isActive ? `2px solid ${theme.colors.secondary}` : '2px solid transparent',
    transition: 'all 0.2s ease',
  });

  const buttonStyles = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '20px',
    padding: '8px',
    borderRadius: '8px',
    transition: 'background 0.2s ease',
  };

  const userStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: theme.colors.text,
  };

  return (
    <nav style={navStyles}>
      <NavLink to="/" style={logoStyles}>
        🎮 React Adventure
      </NavLink>
      
      <div style={linkContainerStyles}>
        <NavLink to="/" style={getLinkStyles}>
          Home
        </NavLink>
        <NavLink to="/hooks" style={getLinkStyles}>
          Hooks Demo
        </NavLink>
        <NavLink to="/forms" style={getLinkStyles}>
          Forms
        </NavLink>
        <NavLink to="/data" style={getLinkStyles}>
          Data Fetching
        </NavLink>
        <NavLink to="/components" style={getLinkStyles}>
          Components
        </NavLink>
        <NavLink to="/about" style={getLinkStyles}>
          About
        </NavLink>
      </div>

      <div style={userStyles}>
        <button 
          onClick={toggleTheme} 
          style={buttonStyles}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
        {isAuthenticated ? (
          <>
            <span>Welcome, {user?.name}!</span>
            <button 
              onClick={logout} 
              style={{...buttonStyles, fontSize: '14px', color: theme.colors.text}}
            >
              Logout
            </button>
          </>
        ) : (
          <NavLink to="/login" style={getLinkStyles}>
            Login
          </NavLink>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
