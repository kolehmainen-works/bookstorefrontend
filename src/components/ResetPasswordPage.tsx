import { Alert, Box, Button, Link, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../api";
import type { MessageResponse } from "../types";

// Opened from the link in the reset email: /#/reset-password?token=...
export default function ResetPasswordPage() {
  const token = useSearchParams()[0].get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [passwordCheck, setPasswordCheck] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tooShort = password.length > 0 && (password.length < 7 || password.length > 30);
  const mismatch = passwordCheck.length > 0 && password !== passwordCheck;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (tooShort || mismatch) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch<MessageResponse>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password, passwordCheck }),
      });
      navigate("/login", { replace: true, state: { message: response.message } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resetting the password failed.");
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <Box className="page narrow">
        <Alert severity="error">Oops! Seems like your link is invalid.</Alert>
        <Link component={RouterLink} to="/forgot-password">
          Request a new link
        </Link>
      </Box>
    );
  }

  return (
    <Box className="page narrow">
      <Typography variant="h4" component="h1" gutterBottom>
        Reset your password
      </Typography>
      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}{" "}
            <Link component={RouterLink} to="/forgot-password">
              Request a new link
            </Link>
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            error={tooShort}
            helperText={tooShort ? "Password must be 7-30 characters long" : " "}
            required
            autoFocus
          />
          <TextField
            label="Re-type password"
            type="password"
            value={passwordCheck}
            onChange={(e) => setPasswordCheck(e.target.value)}
            autoComplete="new-password"
            error={mismatch}
            helperText={mismatch ? "Passwords do not match" : " "}
            required
          />
          <Button type="submit" variant="contained" disabled={submitting || tooShort || mismatch}>
            {submitting ? "Saving..." : "Reset password"}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
