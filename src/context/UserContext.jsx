import { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';

const UserContext = createContext();

const userReducer = (state, action) => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload, isAuthenticated: true };
    case 'LOGOUT':
      return { ...state, user: null, isAuthenticated: false };
    case 'UPDATE_PROFILE':
      return { ...state, user: { ...state.user, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

const initialState = {
  user: null,
  isAuthenticated: false,
  loading: false,
};

export const UserProvider = ({ children }) => {
  const [state, dispatch] = useReducer(userReducer, initialState);

  const login = useCallback((userData) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    // Simulate API call
    setTimeout(() => {
      dispatch({ type: 'SET_USER', payload: userData });
      dispatch({ type: 'SET_LOADING', payload: false });
    }, 1000);
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: 'LOGOUT' });
  }, []);

  const updateProfile = useCallback((updates) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: updates });
  }, []);

  const value = useMemo(() => ({
    ...state,
    login,
    logout,
    updateProfile
  }), [state, login, logout, updateProfile]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
