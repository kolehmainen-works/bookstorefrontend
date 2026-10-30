import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
// HashRouter: GitHub Pages serves only index.html, so routes live after the # (e.g. /#/books)
import { Navigate, Route, HashRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import theme from "./Theme";
import BookForm from "./components/BookForm";
import BookList from "./components/BookList";
import ForgotPasswordPage from "./components/ForgotPasswordPage";
import LoginPage from "./components/LoginPage";
import NavigationBar from "./components/NavigationBar";
import RequireAuth from "./components/RequireAuth";
import ResetPasswordPage from "./components/ResetPasswordPage";
import SignupPage from "./components/SignupPage";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline /> {/* Normalize the styles */}
      <AuthProvider>
        <Router>
          <NavigationBar />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/books" element={<RequireAuth><BookList /></RequireAuth>} />
            <Route path="/books/new" element={<RequireAuth><BookForm /></RequireAuth>} />
            <Route path="/books/:id/edit" element={<RequireAuth><BookForm /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/books" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
