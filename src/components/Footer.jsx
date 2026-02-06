import { useTheme } from '../context/ThemeContext';

const Footer = () => {
  const { theme } = useTheme();

  const footerStyles = {
    textAlign: 'center',
    padding: '32px',
    backgroundColor: theme.colors.card,
    borderTop: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
    marginTop: 'auto',
  };

  const linkStyles = {
    color: theme.colors.secondary,
    textDecoration: 'none',
    margin: '0 12px',
  };

  return (
    <footer style={footerStyles}>
      <p>🚀 Built with React {new Date().getFullYear()}</p>
      <p>
        <a href="https://react.dev" target="_blank" rel="noopener noreferrer" style={linkStyles}>
          React Docs
        </a>
        |
        <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer" style={linkStyles}>
          Vite
        </a>
        |
        <a href="https://reactrouter.com" target="_blank" rel="noopener noreferrer" style={linkStyles}>
          React Router
        </a>
      </p>
      <p style={{ fontSize: '14px', opacity: 0.7 }}>
        Featuring: Hooks, Context API, Router, Forms, Data Fetching, and more!
      </p>
    </footer>
  );
};

export default Footer;
