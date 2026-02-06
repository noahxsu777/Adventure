import { useState, useCallback, useMemo, useRef, useEffect, useReducer } from 'react';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { useDebounce, useWindowSize, usePrevious, useToggle } from '../hooks/useUtils';
import useLocalStorage from '../hooks/useLocalStorage';

const HooksPage = () => {
  const { theme } = useTheme();

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

  const codeStyles = {
    backgroundColor: theme.isDarkMode ? '#0d1117' : '#f6f8fa',
    padding: '12px',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'monospace',
    overflowX: 'auto',
  };

  // useState Demo
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  // useReducer Demo
  const todoReducer = (state, action) => {
    switch (action.type) {
      case 'ADD':
        return [...state, { id: Date.now(), text: action.text, done: false }];
      case 'TOGGLE':
        return state.map(todo => 
          todo.id === action.id ? { ...todo, done: !todo.done } : todo
        );
      case 'REMOVE':
        return state.filter(todo => todo.id !== action.id);
      default:
        return state;
    }
  };
  const [todos, dispatchTodo] = useReducer(todoReducer, []);
  const [newTodo, setNewTodo] = useState('');

  // useCallback Demo
  const increment = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  const decrement = useCallback(() => {
    setCount(c => c - 1);
  }, []);

  // useMemo Demo
  const expensiveCalculation = useMemo(() => {
    let result = 0;
    for (let i = 0; i < 1000000; i++) {
      result += count;
    }
    return result;
  }, [count]);

  // Custom Hooks Demo
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const windowSize = useWindowSize();
  const previousCount = usePrevious(count);
  const [isVisible, { toggle }] = useToggle(false);
  const [storedValue, setStoredValue] = useLocalStorage('demo-key', 'Hello!');

  // useRef Demo
  const inputRef = useRef(null);
  const [clickCount, setClickCount] = useState(0);

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const handleCountClick = () => {
    setClickCount(c => c + 1);
  };

  // useEffect Demo
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAddTodo = () => {
    if (newTodo.trim()) {
      dispatchTodo({ type: 'ADD', text: newTodo });
      setNewTodo('');
    }
  };

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>🪝 React Hooks Showcase</h1>

      <div style={gridStyles}>
        {/* useState */}
        <Card title="useState" subtitle="State management in functional components">
          <div style={{ color: theme.colors.text }}>
            <p>Count: <strong>{count}</strong></p>
            <p>Name: <strong>{name || '(empty)'}</strong></p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <Button onClick={decrement} size="small">-</Button>
              <Button onClick={increment} size="small">+</Button>
              <Button onClick={() => setCount(0)} variant="secondary" size="small">Reset</Button>
            </div>
            <Input 
              name="name" 
              placeholder="Enter your name" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />
          </div>
        </Card>

        {/* useReducer */}
        <Card title="useReducer" subtitle="Complex state with reducers">
          <div style={{ color: theme.colors.text }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <Input 
                name="todo" 
                placeholder="Add todo" 
                value={newTodo} 
                onChange={(e) => setNewTodo(e.target.value)}
              />
              <Button onClick={handleAddTodo} size="small">Add</Button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {todos.map(todo => (
                <li key={todo.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  marginBottom: '8px',
                  textDecoration: todo.done ? 'line-through' : 'none',
                  opacity: todo.done ? 0.6 : 1
                }}>
                  <input 
                    type="checkbox" 
                    checked={todo.done}
                    onChange={() => dispatchTodo({ type: 'TOGGLE', id: todo.id })}
                  />
                  {todo.text}
                  <Button 
                    onClick={() => dispatchTodo({ type: 'REMOVE', id: todo.id })} 
                    size="small" 
                    variant="danger"
                  >×</Button>
                </li>
              ))}
            </ul>
            {todos.length === 0 && <p>No todos yet. Add one!</p>}
          </div>
        </Card>

        {/* useCallback & useMemo */}
        <Card title="useCallback & useMemo" subtitle="Memoization for performance">
          <div style={{ color: theme.colors.text }}>
            <p>Expensive calculation result: <strong>{expensiveCalculation.toLocaleString()}</strong></p>
            <p style={{ fontSize: '13px', opacity: 0.7 }}>
              (Computed from count × 1,000,000)
            </p>
            <pre style={codeStyles}>{`
// useMemo
const result = useMemo(() => {
  return expensiveOperation(count);
}, [count]);

// useCallback
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);
            `.trim()}</pre>
          </div>
        </Card>

        {/* useRef */}
        <Card title="useRef" subtitle="Mutable refs and DOM access">
          <div style={{ color: theme.colors.text }}>
            <p>Click count: <strong>{clickCount}</strong></p>
            <Input 
              ref={inputRef}
              name="refInput" 
              placeholder="Focus me with button" 
              fullWidth
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button onClick={focusInput} size="small" variant="secondary">
                Focus Input
              </Button>
              <Button onClick={handleCountClick} size="small">
                Count Clicks
              </Button>
            </div>
            <pre style={codeStyles}>{`
const inputRef = useRef(null);
const focusInput = () => {
  inputRef.current?.focus();
};
            `.trim()}</pre>
          </div>
        </Card>

        {/* useEffect */}
        <Card title="useEffect" subtitle="Side effects and lifecycle">
          <div style={{ color: theme.colors.text }}>
            <p>Current Time: <strong>{time}</strong></p>
            <p style={{ fontSize: '13px', opacity: 0.7 }}>
              Updates every second using setInterval
            </p>
            <pre style={codeStyles}>{`
useEffect(() => {
  const interval = setInterval(() => {
    setTime(new Date());
  }, 1000);
  return () => clearInterval(interval);
}, []);
            `.trim()}</pre>
          </div>
        </Card>

        {/* Custom Hooks */}
        <Card title="Custom Hooks" subtitle="Reusable hook logic">
          <div style={{ color: theme.colors.text }}>
            <h4>useDebounce</h4>
            <Input 
              name="search" 
              placeholder="Type to search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              fullWidth
            />
            <p>Debounced value (500ms): <strong>{debouncedSearch || '(empty)'}</strong></p>

            <h4>useWindowSize</h4>
            <p>Window: <strong>{windowSize.width}×{windowSize.height}</strong></p>

            <h4>usePrevious</h4>
            <p>Previous count: <strong>{previousCount ?? 'N/A'}</strong></p>

            <h4>useToggle</h4>
            <Button onClick={toggle} size="small">
              {isVisible ? 'Hide' : 'Show'} Content
            </Button>
            {isVisible && <p style={{ marginTop: '8px' }}>👋 Hello there!</p>}

            <h4>useLocalStorage</h4>
            <Input 
              name="localStorage" 
              value={storedValue}
              onChange={(e) => setStoredValue(e.target.value)}
              helperText="This value persists in localStorage"
              fullWidth
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

export default HooksPage;
