import PropTypes from 'prop-types';
import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

const Tabs = ({ tabs, defaultTab = 0 }) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState(defaultTab);

  const containerStyles = {
    width: '100%',
  };

  const tabListStyles = {
    display: 'flex',
    borderBottom: `1px solid ${theme.colors.border}`,
    marginBottom: '20px',
  };

  const tabButtonStyles = (isActive) => ({
    padding: '12px 24px',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: isActive ? `3px solid ${theme.colors.secondary}` : '3px solid transparent',
    color: isActive ? theme.colors.secondary : theme.colors.text,
    fontWeight: isActive ? '600' : '400',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    fontSize: '16px',
  });

  const panelStyles = {
    padding: '16px 0',
    color: theme.colors.text,
  };

  return (
    <div style={containerStyles}>
      <div style={tabListStyles} role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={activeTab === index}
            style={tabButtonStyles(activeTab === index)}
            onClick={() => setActiveTab(index)}
          >
            {tab.icon && <span style={{ marginRight: '8px' }}>{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" style={panelStyles}>
        {tabs[activeTab]?.content}
      </div>
    </div>
  );
};

Tabs.propTypes = {
  tabs: PropTypes.arrayOf(PropTypes.shape({
    label: PropTypes.string.isRequired,
    content: PropTypes.node.isRequired,
    icon: PropTypes.node,
  })).isRequired,
  defaultTab: PropTypes.number,
};

export default Tabs;
