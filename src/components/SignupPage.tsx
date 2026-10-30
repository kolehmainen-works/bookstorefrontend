import { Alert, Box, Button, Link, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Navigate, Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import type { SignupForm } from "../AuthContext";

const emptyForm: SignupForm = { username: "", email: "", password: "", passwordCheck: "" };

export default function SignupPage() {
  const { session, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<SignupForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to="/books" replace />;
  }

  const usernameInvalid = form.username.length > 0 && (form.username.trim().length < 3 || form.username.length > 30);
  const passwordInvalid = form.password.length > 0 && (form.password.length < 7 || form.password.length > 30);
  const mismatch = form.passwordCheck.length > 0 && form.password !== form.passwordCheck;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (usernameInvalid || passwordInvalid || mismatch) return;
    setSubmitting(true);
    setError(null);
    try {
      await signup({ ...form, username: form.username.trim(), email: form.email.trim() });
      navigate("/books", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
      setSubmitting(false);
    }
  };

  return (
    <Box className="page narrow">
      <Typography variant="h4" component="h1" gutterBottom>
        Create an account
      </Typography>
      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField
            label="User name"
            name="username"
            value={form.username}
            onChange={handleChange}
            autoComplete="username"
            error={usernameInvalid}
            helperText={usernameInvalid ? "User name must be 3-30 characters long" : " "}
            required
            autoFocus
          />
          <TextField
            label="Email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            helperText="Used if you forget your password"
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            autoComplete="new-password"
            error={passwordInvalid}
            helperText={passwordInvalid ? "Password must be 7-30 characters long" : " "}
            required
          />
          <TextField
            label="Re-type password"
            name="passwordCheck"
            type="password"
            value={form.passwordCheck}
            onChange={handleChange}
            autoComplete="new-password"
            error={mismatch}
            helperText={mismatch ? "Passwords do not match" : " "}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting || usernameInvalid || passwordInvalid || mismatch}>
            {submitting ? "Creating account..." : "Sign up"}
          </Button>
          <Link component={RouterLink} to="/login" sx={{ mt: 1 }}>
            Already have an account? Sign in
          </Link>
        </Box>
      </Paper>
    </Box>
  );
}
