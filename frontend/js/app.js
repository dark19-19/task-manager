// frontend/js/app.js
const { useState, useEffect } = React;

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // On first load: if we have a token, verify it with /me
  useEffect(() => {
    const token = storage.getToken();
    if (!token) {
      setChecking(false);
      return;
    }

    api.me()
      .then((data) => setUser(data.user))
      .catch(() => storage.clearAll())
      .finally(() => setChecking(false));
  }, []);

  function handleAuthSuccess(u) {
    setUser(u);
  }

  function handleLogout() {
    storage.clearAll();
    setUser(null);
  }

  if (checking) {
    return <div className="loading">Loading…</div>;
  }

  if (!user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return <TasksScreen user={user} onLogout={handleLogout} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);