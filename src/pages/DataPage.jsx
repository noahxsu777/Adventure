import { useState, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import { Spinner } from '../components/Spinner';
import useFetch from '../hooks/useFetch';
import { useDebounce } from '../hooks/useUtils';

const DataPage = () => {
  const { theme } = useTheme();
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

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

  // Fetch users
  const { 
    data: users, 
    loading: usersLoading, 
    error: usersError, 
    refetch: refetchUsers 
  } = useFetch('https://jsonplaceholder.typicode.com/users');

  // Fetch posts
  const { 
    data: posts, 
    loading: postsLoading, 
    error: postsError 
  } = useFetch('https://jsonplaceholder.typicode.com/posts?_limit=10');

  // Fetch selected user's posts
  const { 
    data: userPosts, 
    loading: userPostsLoading 
  } = useFetch(
    selectedUser ? `https://jsonplaceholder.typicode.com/posts?userId=${selectedUser.id}` : null,
    { immediate: !!selectedUser }
  );

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!debouncedSearch) return users;
    return users.filter(user => 
      user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [users, debouncedSearch]);

  const userCardStyles = {
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '8px',
    backgroundColor: theme.colors.background,
    cursor: 'pointer',
    border: `1px solid ${theme.colors.border}`,
    transition: 'all 0.2s ease',
  };

  const postCardStyles = {
    padding: '12px',
    marginBottom: '8px',
    borderRadius: '8px',
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
  };

  return (
    <div style={containerStyles}>
      <h1 style={titleStyles}>🔗 Data Fetching</h1>
      <p style={{ color: theme.colors.text, textAlign: 'center', marginBottom: '40px' }}>
        Custom useFetch hook with loading states, error handling, and request cancellation
      </p>

      <div style={gridStyles}>
        {/* Users List */}
        <Card 
          title="Users" 
          subtitle="Data from JSONPlaceholder API"
          footer={
            <Button onClick={refetchUsers} size="small" variant="secondary">
              🔄 Refresh
            </Button>
          }
        >
          <Input
            name="search"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            fullWidth
            icon="🔍"
          />

          {usersLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spinner />
              <p style={{ color: theme.colors.text, marginTop: '16px' }}>Loading users...</p>
            </div>
          )}

          {usersError && (
            <div style={{ 
              color: '#dc3545', 
              padding: '20px', 
              textAlign: 'center',
              backgroundColor: 'rgba(220, 53, 69, 0.1)',
              borderRadius: '8px'
            }}>
              <p>❌ Error: {usersError}</p>
              <Button onClick={refetchUsers} variant="danger" size="small">
                Retry
              </Button>
            </div>
          )}

          {!usersLoading && !usersError && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  style={{
                    ...userCardStyles,
                    borderColor: selectedUser?.id === user.id ? theme.colors.secondary : theme.colors.border,
                    boxShadow: selectedUser?.id === user.id ? `0 0 0 2px ${theme.colors.secondary}` : 'none',
                  }}
                  onClick={() => setSelectedUser(user)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedUser(user);
                    }
                  }}
                >
                  <h4 style={{ color: theme.colors.text, margin: '0 0 4px' }}>
                    {user.name}
                  </h4>
                  <p style={{ 
                    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280', 
                    margin: 0,
                    fontSize: '14px'
                  }}>
                    📧 {user.email}
                  </p>
                  <p style={{ 
                    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280', 
                    margin: '4px 0 0',
                    fontSize: '12px'
                  }}>
                    🏢 {user.company?.name}
                  </p>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <p style={{ color: theme.colors.text, textAlign: 'center' }}>
                  No users found matching &quot;{debouncedSearch}&quot;
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Selected User Details */}
        <Card 
          title={selectedUser ? `${selectedUser.name}'s Posts` : 'Select a User'}
          subtitle={selectedUser ? `${userPosts?.length || 0} posts` : 'Click on a user to see their posts'}
        >
          {!selectedUser && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              color: theme.colors.text
            }}>
              <p style={{ fontSize: '48px', marginBottom: '16px' }}>👆</p>
              <p>Select a user from the list to view their posts</p>
            </div>
          )}

          {selectedUser && userPostsLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spinner />
              <p style={{ color: theme.colors.text, marginTop: '16px' }}>Loading posts...</p>
            </div>
          )}

          {selectedUser && !userPostsLoading && userPosts && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {userPosts.map(post => (
                <div key={post.id} style={postCardStyles}>
                  <h4 style={{ 
                    color: theme.colors.text, 
                    margin: '0 0 8px',
                    textTransform: 'capitalize'
                  }}>
                    {post.title}
                  </h4>
                  <p style={{ 
                    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280', 
                    margin: 0,
                    fontSize: '14px',
                    lineHeight: 1.5
                  }}>
                    {post.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Posts Feed */}
        <Card 
          title="Recent Posts" 
          subtitle="Latest 10 posts from all users"
        >
          {postsLoading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spinner />
              <p style={{ color: theme.colors.text, marginTop: '16px' }}>Loading posts...</p>
            </div>
          )}

          {postsError && (
            <div style={{ color: '#dc3545', padding: '20px', textAlign: 'center' }}>
              ❌ Error: {postsError}
            </div>
          )}

          {!postsLoading && !postsError && posts && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {posts.map(post => (
                <div key={post.id} style={postCardStyles}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <h4 style={{ 
                      color: theme.colors.text, 
                      margin: 0,
                      textTransform: 'capitalize',
                      flex: 1
                    }}>
                      {post.title}
                    </h4>
                    <span style={{
                      backgroundColor: theme.colors.secondary,
                      color: '#fff',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      marginLeft: '8px'
                    }}>
                      #{post.id}
                    </span>
                  </div>
                  <p style={{ 
                    color: theme.isDarkMode ? '#a0a0a0' : '#6b7280', 
                    margin: 0,
                    fontSize: '14px',
                    lineHeight: 1.5
                  }}>
                    {post.body.substring(0, 100)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DataPage;
