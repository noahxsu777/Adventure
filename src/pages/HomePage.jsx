import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import Card from '../components/Card';
import Button from '../components/Button';
import { Link } from 'react-router-dom';

const HomePage = () => {
  const { theme } = useTheme();
  const { isAuthenticated, user, login } = useUser();

  const containerStyles = {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const heroStyles = {
    textAlign: 'center',
    marginBottom: '60px',
  };

  const titleStyles = {
    fontSize: '3rem',
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: '16px',
    background: `linear-gradient(135deg, ${theme.colors.secondary}, ${theme.colors.primary})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  };

  const subtitleStyles = {
    fontSize: '1.25rem',
    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280',
    marginBottom: '32px',
  };

  const gridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    marginTop: '40px',
  };

  const featureCardStyles = {
    textAlign: 'center',
    color: theme.colors.text,
  };

  const iconStyles = {
    fontSize: '3rem',
    marginBottom: '16px',
  };

  const features = [
    {
      icon: '⚛️',
      title: 'React 19',
      description: 'Built with the latest React version featuring automatic batching, transitions, and more.',
    },
    {
      icon: '🔄',
      title: 'React Router',
      description: 'Client-side routing with React Router v7 for seamless navigation.',
    },
    {
      icon: '🎨',
      title: 'Theme Support',
      description: 'Dark and light mode support using Context API for state management.',
    },
    {
      icon: '📝',
      title: 'Custom Forms',
      description: 'Form handling with custom hooks including validation and submission.',
    },
    {
      icon: '🔗',
      title: 'Data Fetching',
      description: 'Custom useFetch hook with loading states, error handling, and cancellation.',
    },
    {
      icon: '🧩',
      title: 'Reusable Components',
      description: 'Modular, well-documented components with PropTypes validation.',
    },
  ];

  const handleQuickLogin = () => {
    login({ name: 'Demo User', email: 'demo@example.com' });
  };

  return (
    <div style={containerStyles}>
      <div style={heroStyles}>
        <h1 style={titleStyles}>🎮 React Adventure</h1>
        <p style={subtitleStyles}>
          A comprehensive React showcase featuring hooks, context, routing, forms, and more!
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link to="/hooks">
            <Button variant="primary" size="large">
              Explore Hooks
            </Button>
          </Link>
          <Link to="/components">
            <Button variant="secondary" size="large">
              View Components
            </Button>
          </Link>
        </div>
      </div>

      {!isAuthenticated && (
        <Card 
          title="Quick Demo" 
          subtitle="Try the app with a demo account"
          style={{ marginBottom: '40px', textAlign: 'center' }}
        >
          <Button onClick={handleQuickLogin} variant="success">
            Login as Demo User
          </Button>
        </Card>
      )}

      {isAuthenticated && (
        <Card 
          title={`Welcome back, ${user?.name}!`} 
          style={{ marginBottom: '40px' }}
        >
          <p style={{ color: theme.colors.text }}>
            You&apos;re logged in! Feel free to explore the application and see the various React features in action.
          </p>
        </Card>
      )}

      <h2 style={{ color: theme.colors.text, marginBottom: '20px', textAlign: 'center' }}>
        ✨ Features Showcase
      </h2>

      <div style={gridStyles}>
        {features.map((feature, index) => (
          <Card key={index} hoverable>
            <div style={featureCardStyles}>
              <div style={iconStyles}>{feature.icon}</div>
              <h3 style={{ marginBottom: '12px' }}>{feature.title}</h3>
              <p style={{ opacity: 0.8, margin: 0 }}>{feature.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
