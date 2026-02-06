import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';

const Accordion = ({ items, allowMultiple = false }) => {
  const { theme } = useTheme();
  const [openItems, setOpenItems] = useState([]);

  const toggleItem = useCallback((index) => {
    setOpenItems(prev => {
      if (allowMultiple) {
        return prev.includes(index) 
          ? prev.filter(i => i !== index) 
          : [...prev, index];
      } else {
        return prev.includes(index) ? [] : [index];
      }
    });
  }, [allowMultiple]);

  const containerStyles = {
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  };

  const itemStyles = {
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const headerStyles = (isOpen) => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    backgroundColor: isOpen ? theme.colors.card : 'transparent',
    cursor: 'pointer',
    color: theme.colors.text,
    fontWeight: '500',
    border: 'none',
    width: '100%',
    textAlign: 'left',
    transition: 'background-color 0.2s ease',
  });

  const contentStyles = (isOpen) => ({
    maxHeight: isOpen ? '1000px' : '0',
    overflow: 'hidden',
    transition: 'max-height 0.3s ease',
  });

  const contentInnerStyles = {
    padding: '16px',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
  };

  const arrowStyles = (isOpen) => ({
    transition: 'transform 0.2s ease',
    transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
  });

  return (
    <div style={containerStyles}>
      {items.map((item, index) => {
        const isOpen = openItems.includes(index);
        return (
          <div key={index} style={index < items.length - 1 ? itemStyles : {}}>
            <button 
              style={headerStyles(isOpen)} 
              onClick={() => toggleItem(index)}
              aria-expanded={isOpen}
            >
              <span>{item.title}</span>
              <span style={arrowStyles(isOpen)}>▼</span>
            </button>
            <div style={contentStyles(isOpen)}>
              <div style={contentInnerStyles}>
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

Accordion.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string.isRequired,
    content: PropTypes.node.isRequired,
  })).isRequired,
  allowMultiple: PropTypes.bool,
};

export default Accordion;
