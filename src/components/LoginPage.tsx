import { Alert, Box, Button, Link, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface LocationState {
  from?: string;
  message?: string;
}

// login.html of kolehmainenbookstore
export default function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as LocationState;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to={state.from ?? "/books"} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate(state.from ?? "/books", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="page narrow">
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to Bookstore
      </Typography>
      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!error && state.message && <Alert severity="info" sx={{ mb: 2 }}>{state.message}</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="User name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          <Link component={RouterLink} to="/forgot-password">
            Forgot password?
          </Link>
          <Link component={RouterLink} to="/signup">
            New here? Create an account
          </Link>
        </Box>
      </Paper>
    </Box>
  );
}
