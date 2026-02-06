import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { UserProvider } from './context/UserContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import HooksPage from './pages/HooksPage';
import FormsPage from './pages/FormsPage';
import DataPage from './pages/DataPage';
import ComponentsPage from './pages/ComponentsPage';
import AboutPage from './pages/AboutPage';
import './App.css';

const AppContent = () => {
  const { theme } = useTheme();

  const appStyles = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    transition: 'background-color 0.3s ease, color 0.3s ease',
  };

  return (
    <div style={appStyles}>
      <Navbar />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/hooks" element={<HooksPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/data" element={<DataPage />} />
          <Route path="/components" element={<ComponentsPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <ThemeProvider>
        <UserProvider>
          <AppContent />
        </UserProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;
