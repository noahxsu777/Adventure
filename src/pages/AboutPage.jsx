import { useTheme } from '../context/ThemeContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Accordion from '../components/Accordion';

const AboutPage = () => {
  const { theme } = useTheme();

  const containerStyles = {
    padding: '40px',
    maxWidth: '900px',
    margin: '0 auto',
  };

  const titleStyles = {
    color: theme.colors.text,
    marginBottom: '16px',
    textAlign: 'center',
  };

  const subtitleStyles = {
    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280',
    textAlign: 'center',
    marginBottom: '40px',
    fontSize: '1.1rem',
  };

  const techStackStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginTop: '24px',
  };

  const techItemStyles = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: theme.colors.background,
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
  };

  const technologies = [
    { icon: '⚛️', name: 'React 19' },
    { icon: '⚡', name: 'Vite' },
    { icon: '🛣️', name: 'React Router v7' },
    { icon: '📦', name: 'Axios' },
    { icon: '✅', name: 'PropTypes' },
    { icon: '🎨', name: 'CSS-in-JS' },
  ];

  const features = [
    {
      title: '🪝 Custom Hooks',
      content: 'The project includes several custom hooks: useFetch for data fetching, useForm for form handling, useLocalStorage for persistence, and utility hooks like useDebounce, useToggle, and useWindowSize.',
    },
    {
      title: '🌐 Context API',
      content: 'Theme and User contexts demonstrate how to manage global state without external libraries. The ThemeContext handles dark/light mode, while UserContext manages authentication state.',
    },
    {
      title: '📋 Forms & Validation',
      content: 'The useForm hook provides complete form management including controlled inputs, validation, error handling, submission states, and form reset functionality.',
    },
    {
      title: '🔗 Data Fetching',
      content: 'The useFetch hook provides a clean interface for making HTTP requests with loading states, error handling, request cancellation, and refetch capabilities.',
    },
    {
      title: '🧩 Component Library',
      content: 'Reusable components include Button, Card, Input, Modal, Accordion, Tabs, Spinner, and more. All components support theming and include PropTypes validation.',
    },
    {
      title: '🌙 Theme Support',
      content: 'Full dark and light mode support throughout the application. Theme preferences are managed via Context API and can be toggled from the navigation bar.',
    },
  ];

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>🎮 About React Adventure</h1>
      <p style={subtitleStyles}>
        A comprehensive showcase of modern React development patterns and best practices
      </p>

      <Card title="Project Overview" style={{ marginBottom: '24px' }}>
        <p style={{ color: theme.colors.text, lineHeight: 1.8 }}>
          This project demonstrates various React concepts and patterns that are commonly used 
          in production applications. It serves as both a learning resource and a reference 
          implementation for React developers.
        </p>
        <p style={{ color: theme.colors.text, lineHeight: 1.8, marginTop: '16px' }}>
          The codebase is organized with a focus on maintainability, reusability, and 
          separation of concerns. Components are modular and well-documented with PropTypes 
          for type checking.
        </p>
      </Card>

      <Card title="Technology Stack" style={{ marginBottom: '24px' }}>
        <div style={techStackStyles}>
          {technologies.map((tech, index) => (
            <div key={index} style={techItemStyles}>
              <span style={{ fontSize: '24px' }}>{tech.icon}</span>
              <span>{tech.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Features Explained" style={{ marginBottom: '24px' }}>
        <Accordion items={features} allowMultiple />
      </Card>

      <Card title="Project Structure">
        <pre style={{ 
          color: theme.colors.text,
          backgroundColor: theme.isDarkMode ? '#0d1117' : '#f6f8fa',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '13px',
          overflow: 'auto',
          lineHeight: 1.6,
        }}>
{`src/
├── components/          # Reusable UI components
│   ├── Accordion.jsx
│   ├── Button.jsx
│   ├── Card.jsx
│   ├── Footer.jsx
│   ├── Input.jsx
│   ├── Modal.jsx
│   ├── Navbar.jsx
│   ├── Spinner.jsx
│   └── Tabs.jsx
├── context/             # React Context providers
│   ├── ThemeContext.jsx
│   └── UserContext.jsx
├── hooks/               # Custom React hooks
│   ├── useFetch.js
│   ├── useForm.js
│   ├── useLocalStorage.js
│   └── useUtils.js
├── pages/               # Page components
│   ├── AboutPage.jsx
│   ├── ComponentsPage.jsx
│   ├── DataPage.jsx
│   ├── FormsPage.jsx
│   ├── HooksPage.jsx
│   └── HomePage.jsx
├── App.jsx              # Main application component
└── main.jsx             # Application entry point`}
        </pre>
      </Card>

      <div style={{ textAlign: 'center', marginTop: '40px' }}>
        <p style={{ color: theme.colors.text, marginBottom: '16px' }}>
          Ready to explore more?
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
            <Button variant="primary">React Docs</Button>
          </a>
          <a href="https://vitejs.dev" target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">Vite Docs</Button>
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
