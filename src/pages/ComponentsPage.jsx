import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Modal from '../components/Modal';
import Accordion from '../components/Accordion';
import Tabs from '../components/Tabs';
import { Spinner, LoadingOverlay } from '../components/Spinner';

const ComponentsPage = () => {
  const { theme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '24px',
  };

  const sectionStyles = {
    marginBottom: '48px',
  };

  const sectionTitleStyles = {
    color: theme.colors.text,
    marginBottom: '20px',
    borderBottom: `2px solid ${theme.colors.border}`,
    paddingBottom: '8px',
  };

  const accordionItems = [
    {
      title: 'What is React?',
      content: 'React is a JavaScript library for building user interfaces. It was developed by Facebook and is now maintained by Facebook and a community of individual developers and companies.',
    },
    {
      title: 'What are React Hooks?',
      content: 'Hooks are functions that let you "hook into" React state and lifecycle features from function components. They were introduced in React 16.8 and allow you to use state and other React features without writing a class.',
    },
    {
      title: 'What is the Context API?',
      content: 'Context provides a way to pass data through the component tree without having to pass props down manually at every level. It\'s designed to share data that can be considered "global" for a tree of React components.',
    },
  ];

  const tabItems = [
    {
      label: 'Overview',
      icon: '📋',
      content: (
        <div style={{ color: theme.colors.text }}>
          <h3>Overview Tab</h3>
          <p>This tab demonstrates a simple overview panel. Tabs are a great way to organize content into logical sections without cluttering the interface.</p>
        </div>
      ),
    },
    {
      label: 'Features',
      icon: '✨',
      content: (
        <div style={{ color: theme.colors.text }}>
          <h3>Features</h3>
          <ul>
            <li>Responsive design</li>
            <li>Theme support (dark/light)</li>
            <li>Accessibility friendly</li>
            <li>Keyboard navigation</li>
          </ul>
        </div>
      ),
    },
    {
      label: 'Settings',
      icon: '⚙️',
      content: (
        <div style={{ color: theme.colors.text }}>
          <h3>Settings</h3>
          <p>Configure your preferences here. This is just a demo content showing how tabs work.</p>
          <Input name="setting1" placeholder="Enter a setting value..." fullWidth />
        </div>
      ),
    },
  ];

  const simulateLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>🧩 Component Library</h1>
      <p style={{ color: theme.colors.text, textAlign: 'center', marginBottom: '40px' }}>
        Reusable, accessible components built with React
      </p>

      {/* Buttons Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>🔘 Buttons</h2>
        <div style={gridStyles}>
          <Card title="Button Variants" subtitle="Different button styles for different actions">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="success">Success</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
          </Card>
          <Card title="Button Sizes" subtitle="Small, medium, and large options">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <Button size="small">Small</Button>
              <Button size="medium">Medium</Button>
              <Button size="large">Large</Button>
            </div>
          </Card>
          <Card title="Button States" subtitle="Loading, disabled, and with icons">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
              <Button icon="🚀">With Icon</Button>
              <Button fullWidth variant="secondary">Full Width</Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Cards Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>🃏 Cards</h2>
        <div style={gridStyles}>
          <Card title="Basic Card" subtitle="A simple card with title and subtitle">
            <p style={{ color: theme.colors.text }}>
              Cards are versatile containers for content. They can include headers, bodies, and footers.
            </p>
          </Card>
          <Card 
            title="Card with Footer" 
            subtitle="Including action buttons"
            footer={
              <>
                <Button size="small" variant="secondary">Cancel</Button>
                <Button size="small">Save</Button>
              </>
            }
          >
            <p style={{ color: theme.colors.text }}>
              This card has a footer with action buttons for user interaction.
            </p>
          </Card>
          <Card 
            title="Clickable Card" 
            subtitle="Click me!"
            onClick={() => alert('Card clicked!')}
            hoverable
          >
            <p style={{ color: theme.colors.text }}>
              This card is clickable and will trigger an action when clicked.
            </p>
          </Card>
        </div>
      </section>

      {/* Inputs Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>📝 Inputs</h2>
        <div style={gridStyles}>
          <Card title="Input States" subtitle="Various input configurations">
            <Input label="Default Input" name="default" placeholder="Enter text..." fullWidth />
            <Input label="With Icon" name="icon" icon="🔍" placeholder="Search..." fullWidth />
            <Input label="With Error" name="error" error="This field is required" fullWidth />
            <Input label="Disabled" name="disabled" disabled value="Disabled input" fullWidth />
          </Card>
          <Card title="Input Types" subtitle="Different input types">
            <Input label="Text" name="text" type="text" placeholder="Enter text..." fullWidth />
            <Input label="Email" name="email" type="email" placeholder="email@example.com" fullWidth />
            <Input label="Password" name="password" type="password" placeholder="********" fullWidth />
            <Input label="Number" name="number" type="number" placeholder="0" fullWidth />
          </Card>
        </div>
      </section>

      {/* Modal Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>🪟 Modal</h2>
        <Card title="Modal Dialog" subtitle="Overlay for important content">
          <p style={{ color: theme.colors.text, marginBottom: '16px' }}>
            Modals are dialogs that appear on top of the main content. They are useful for confirmations, forms, or displaying important information.
          </p>
          <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
        </Card>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Example Modal"
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={() => setIsModalOpen(false)}>Confirm</Button>
            </>
          }
        >
          <p>This is a modal dialog. You can put any content here, including forms, images, or other components.</p>
          <Input label="Example Input" name="modalInput" placeholder="Type something..." fullWidth />
        </Modal>
      </section>

      {/* Accordion Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>🪗 Accordion</h2>
        <div style={gridStyles}>
          <Card title="Single Open" subtitle="Only one item can be open at a time">
            <Accordion items={accordionItems} />
          </Card>
          <Card title="Multiple Open" subtitle="Multiple items can be open simultaneously">
            <Accordion items={accordionItems} allowMultiple />
          </Card>
        </div>
      </section>

      {/* Tabs Section */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>📑 Tabs</h2>
        <Card title="Tab Component" subtitle="Organize content into switchable panels">
          <Tabs tabs={tabItems} />
        </Card>
      </section>

      {/* Loading States */}
      <section style={sectionStyles}>
        <h2 style={sectionTitleStyles}>⏳ Loading States</h2>
        <div style={gridStyles}>
          <Card title="Spinner" subtitle="Loading indicator">
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <Spinner size={24} />
              <Spinner size={40} />
              <Spinner size={56} />
            </div>
          </Card>
          <Card title="Loading Overlay" subtitle="Overlay with loading indicator">
            <LoadingOverlay isLoading={isLoading} message="Please wait...">
              <div style={{ padding: '40px', textAlign: 'center', color: theme.colors.text }}>
                <p>This content will be covered by a loading overlay</p>
                <Button onClick={simulateLoading}>Simulate Loading (2s)</Button>
              </div>
            </LoadingOverlay>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default ComponentsPage;
