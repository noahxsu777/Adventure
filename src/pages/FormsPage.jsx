import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useUser } from '../context/UserContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import useForm from '../hooks/useForm';

const FormsPage = () => {
  const { theme } = useTheme();
  const { login, isAuthenticated, user, updateProfile } = useUser();
  const [submittedData, setSubmittedData] = useState(null);

  const containerStyles = {
    padding: '40px',
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const titleStyles = {
    color: theme.colors.text,
    marginBottom: '40px',
    textAlign: 'center',
  };

  const gridStyles = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  };

  const resultStyles = {
    backgroundColor: theme.isDarkMode ? '#0d1117' : '#f6f8fa',
    padding: '16px',
    borderRadius: '8px',
    marginTop: '16px',
  };

  // Contact Form Validation
  const contactValidate = (values) => {
    const errors = {};
    if (!values.name?.trim()) errors.name = 'Name is required';
    if (!values.email?.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(values.email)) {
      errors.email = 'Email is invalid';
    }
    if (!values.message?.trim()) {
      errors.message = 'Message is required';
    } else if (values.message.length < 10) {
      errors.message = 'Message must be at least 10 characters';
    }
    return errors;
  };

  const contactForm = useForm(
    { name: '', email: '', message: '', newsletter: false },
    contactValidate
  );

  const handleContactSubmit = async (values) => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSubmittedData(values);
    contactForm.reset();
  };

  // Login Form Validation
  const loginValidate = (values) => {
    const errors = {};
    if (!values.username?.trim()) errors.username = 'Username is required';
    if (!values.password?.trim()) {
      errors.password = 'Password is required';
    } else if (values.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    return errors;
  };

  const loginForm = useForm(
    { username: '', password: '', rememberMe: false },
    loginValidate
  );

  const handleLoginSubmit = async (values) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    login({ name: values.username, email: `${values.username}@example.com` });
    loginForm.reset();
  };

  // Profile Form
  const profileValidate = (values) => {
    const errors = {};
    if (!values.displayName?.trim()) errors.displayName = 'Display name is required';
    if (values.bio && values.bio.length > 200) errors.bio = 'Bio must be under 200 characters';
    return errors;
  };

  const profileForm = useForm(
    { displayName: user?.name || '', bio: '', website: '' },
    profileValidate
  );

  const handleProfileSubmit = async (values) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    updateProfile({ name: values.displayName, bio: values.bio, website: values.website });
    alert('Profile updated!');
  };

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>📝 React Forms</h1>
      <p style={{ color: theme.colors.text, textAlign: 'center', marginBottom: '40px' }}>
        Custom useForm hook with validation, error handling, and controlled inputs
      </p>

      <div style={gridStyles}>
        {/* Contact Form */}
        <Card title="Contact Form" subtitle="With validation and error messages">
          <form onSubmit={contactForm.handleSubmit(handleContactSubmit)}>
            <Input
              label="Name"
              name="name"
              value={contactForm.values.name}
              onChange={contactForm.handleChange}
              onBlur={contactForm.handleBlur}
              error={contactForm.touched.name && contactForm.errors.name}
              required
              fullWidth
              icon="👤"
            />
            <Input
              label="Email"
              name="email"
              type="email"
              value={contactForm.values.email}
              onChange={contactForm.handleChange}
              onBlur={contactForm.handleBlur}
              error={contactForm.touched.email && contactForm.errors.email}
              required
              fullWidth
              icon="📧"
            />
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '6px', 
                color: theme.colors.text,
                fontWeight: '500',
                fontSize: '14px'
              }}>
                Message <span style={{ color: '#dc3545' }}>*</span>
              </label>
              <textarea
                name="message"
                value={contactForm.values.message}
                onChange={contactForm.handleChange}
                onBlur={contactForm.handleBlur}
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${contactForm.touched.message && contactForm.errors.message ? '#dc3545' : theme.colors.border}`,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  resize: 'vertical',
                }}
              />
              {contactForm.touched.message && contactForm.errors.message && (
                <span style={{ color: '#dc3545', fontSize: '12px' }}>
                  {contactForm.errors.message}
                </span>
              )}
            </div>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              color: theme.colors.text,
              marginBottom: '16px'
            }}>
              <input
                type="checkbox"
                name="newsletter"
                checked={contactForm.values.newsletter}
                onChange={contactForm.handleChange}
              />
              Subscribe to newsletter
            </label>
            <Button 
              type="submit" 
              loading={contactForm.isSubmitting}
              fullWidth
            >
              Send Message
            </Button>
          </form>

          {submittedData && (
            <div style={resultStyles}>
              <h4 style={{ color: theme.colors.text, margin: '0 0 8px' }}>✅ Form Submitted!</h4>
              <pre style={{ margin: 0, fontSize: '12px', color: theme.colors.text }}>
                {JSON.stringify(submittedData, null, 2)}
              </pre>
            </div>
          )}
        </Card>

        {/* Login Form */}
        <Card title="Login Form" subtitle="Authentication example with useContext">
          {isAuthenticated ? (
            <div style={{ color: theme.colors.text, textAlign: 'center' }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>👋</p>
              <h3>Welcome, {user?.name}!</h3>
              <p>You are logged in.</p>
            </div>
          ) : (
            <form onSubmit={loginForm.handleSubmit(handleLoginSubmit)}>
              <Input
                label="Username"
                name="username"
                value={loginForm.values.username}
                onChange={loginForm.handleChange}
                onBlur={loginForm.handleBlur}
                error={loginForm.touched.username && loginForm.errors.username}
                required
                fullWidth
                icon="👤"
              />
              <Input
                label="Password"
                name="password"
                type="password"
                value={loginForm.values.password}
                onChange={loginForm.handleChange}
                onBlur={loginForm.handleBlur}
                error={loginForm.touched.password && loginForm.errors.password}
                required
                fullWidth
                icon="🔒"
              />
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                color: theme.colors.text,
                marginBottom: '16px'
              }}>
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={loginForm.values.rememberMe}
                  onChange={loginForm.handleChange}
                />
                Remember me
              </label>
              <Button 
                type="submit" 
                loading={loginForm.isSubmitting}
                fullWidth
              >
                Login
              </Button>
            </form>
          )}
        </Card>

        {/* Profile Form */}
        {isAuthenticated && (
          <Card title="Edit Profile" subtitle="Update your user information">
            <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
              <Input
                label="Display Name"
                name="displayName"
                value={profileForm.values.displayName}
                onChange={profileForm.handleChange}
                onBlur={profileForm.handleBlur}
                error={profileForm.touched.displayName && profileForm.errors.displayName}
                required
                fullWidth
              />
              <div style={{ marginBottom: '16px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  color: theme.colors.text,
                  fontWeight: '500',
                  fontSize: '14px'
                }}>
                  Bio
                </label>
                <textarea
                  name="bio"
                  placeholder="Tell us about yourself..."
                  value={profileForm.values.bio}
                  onChange={profileForm.handleChange}
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.colors.border}`,
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    resize: 'vertical',
                  }}
                />
                <span style={{ color: theme.isDarkMode ? '#a0a0a0' : '#6b7280', fontSize: '12px' }}>
                  {profileForm.values.bio.length}/200 characters
                </span>
              </div>
              <Input
                label="Website"
                name="website"
                type="url"
                placeholder="https://example.com"
                value={profileForm.values.website}
                onChange={profileForm.handleChange}
                fullWidth
              />
              <Button 
                type="submit" 
                loading={profileForm.isSubmitting}
                fullWidth
                variant="success"
              >
                Save Profile
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
};

export default FormsPage;
