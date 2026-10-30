import { Alert, Box, Button, Link, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link as RouterLink } from "react-router-dom";
import { apiFetch } from "../api";
import type { MessageResponse } from "../types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<MessageResponse>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(response.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sending the link failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box className="page narrow">
      <Typography variant="h4" component="h1" gutterBottom>
        Forgot password
      </Typography>
      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2">
            Enter the email address of your account and we will send you a link to reset your password.
          </Typography>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            autoFocus
          />
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? "Sending..." : "Send link"}
          </Button>
          <Link component={RouterLink} to="/login">
            Back to sign in
          </Link>
        </Box>
      </Paper>
    </Box>
  );
}
