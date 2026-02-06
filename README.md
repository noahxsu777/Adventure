# 🎮 React Adventure

A comprehensive React application showcasing modern React development patterns and best practices.

## ✨ Features

- **React 19** - Built with the latest React version
- **React Router v7** - Client-side routing for seamless navigation
- **Context API** - Theme and user state management without external libraries
- **Custom Hooks** - Reusable hook logic for common patterns
- **Form Handling** - Custom useForm hook with validation
- **Data Fetching** - Custom useFetch hook with loading/error states
- **Component Library** - Modular, accessible, reusable components
- **Dark/Light Mode** - Full theme support throughout the app

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
src/
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
└── main.jsx             # Application entry point
```

## 🪝 Custom Hooks

### useFetch
Data fetching with loading states, error handling, and request cancellation.

```jsx
const { data, loading, error, refetch } = useFetch('/api/users');
```

### useForm
Form state management with validation and submission handling.

```jsx
const form = useForm(initialValues, validate);
```

### useLocalStorage
Persist state in localStorage with automatic sync.

```jsx
const [value, setValue] = useLocalStorage('key', defaultValue);
```

### Utility Hooks
- `useDebounce` - Debounce rapidly changing values
- `useThrottle` - Throttle rapidly changing values
- `useToggle` - Boolean toggle with helpers
- `useClickOutside` - Detect clicks outside an element
- `useWindowSize` - Track window dimensions
- `usePrevious` - Access previous value of a state

## 🧩 Components

- **Button** - Versatile button with variants, sizes, and states
- **Card** - Content container with header, body, and footer
- **Input** - Form input with label, error, and icon support
- **Modal** - Dialog overlay with customizable content
- **Accordion** - Expandable content panels
- **Tabs** - Tabbed content navigation
- **Spinner** - Loading indicators

## 🛠️ Tech Stack

- [React 19](https://react.dev)
- [Vite](https://vitejs.dev)
- [React Router v7](https://reactrouter.com)
- [Axios](https://axios-http.com)
- [PropTypes](https://www.npmjs.com/package/prop-types)

## 📜 License

MIT
