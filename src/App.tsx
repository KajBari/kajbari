import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Dashboard } from "./pages/Dashboard";
import { Admin } from "./pages/Admin";
import { useAuthStore } from "./store/authStore";

function App() {
  const { initAuth, user, loading, vpnChecked } = useAuthStore();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Auth Guard: Only redirect if they are on /login and already logged in
  useEffect(() => {
    if (user && location === "/login") {
      setLocation("/");
    }
  }, [user, location, setLocation]);

  if (loading || !vpnChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/admin" component={Admin} />
        <Route>
          <div className="text-center py-20">404 Not Found</div>
        </Route>
      </Switch>
    </Layout>
  );
}

export default App;
