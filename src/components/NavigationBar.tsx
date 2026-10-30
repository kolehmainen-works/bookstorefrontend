import { AppBar, Box, Button, Toolbar, Typography } from "@mui/material";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function NavigationBar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate("/login", { state: { message: "You have been logged out." } });
  };

  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/books"
          sx={{ color: "inherit", textDecoration: "none", flexGrow: 1 }}
        >
          Bookstore
        </Typography>
        {session && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Typography variant="body2">Logged in as: {session.username}</Typography>
            <Button color="inherit" variant="outlined" size="small" onClick={signOut}>
              Sign out
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
