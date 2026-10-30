import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../AuthContext";
import type { Book } from "../types";
import "./BookList.css";

const priceFormatter = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

// booklist.html of kolehmainenbookstore
export default function BookList() {
  const { isAdmin } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBooks = useCallback(() => {
    apiFetch<Book[]>("/api/books")
      .then((data) => {
        setBooks(data);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const deleteBook = useCallback(
    (book: Book) => {
      if (!window.confirm(`Delete "${book.title}"?`)) return;
      apiFetch<void>(`/api/books/${book.id}`, { method: "DELETE" })
        .then(fetchBooks)
        .catch((err: Error) => setError(err.message));
    },
    [fetchBooks]
  );

  const columnDefs = useMemo<ColDef<Book>[]>(
    () => [
      { field: "id", headerName: "Product code", maxWidth: 140, filter: "agNumberColumnFilter" },
      { field: "author", headerName: "Author" },
      { field: "title", headerName: "Title" },
      { field: "publicationYear", headerName: "Year", maxWidth: 110, filter: "agNumberColumnFilter" },
      { field: "category.name", headerName: "Category" },
      { field: "isbn", headerName: "ISBN" },
      {
        field: "price",
        headerName: "Price",
        maxWidth: 120,
        filter: "agNumberColumnFilter",
        valueFormatter: (params) => (params.value == null ? "" : priceFormatter.format(params.value)),
      },
      {
        headerName: "Actions",
        sortable: false,
        filter: false,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams<Book>) =>
          params.data && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", height: "100%" }}>
              <Button size="small" variant="contained" color="success" component={RouterLink} to={`/books/${params.data.id}/edit`}>
                Edit
              </Button>
              {isAdmin && (
                <Button size="small" variant="contained" color="error" onClick={() => deleteBook(params.data!)}>
                  Delete
                </Button>
              )}
            </Box>
          ),
      },
    ],
    [isAdmin, deleteBook]
  );

  return (
    <Box className="page">
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4" component="h1">
          Books
        </Typography>
        <Button variant="contained" component={RouterLink} to="/books/new">
          Add new book
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box className="loading-container">
          <CircularProgress />
        </Box>
      ) : (
        <div className="ag-theme-alpine grid-container">
          <AgGridReact<Book>
            rowData={books}
            columnDefs={columnDefs}
            defaultColDef={{ flex: 1, minWidth: 100, sortable: true, filter: "agTextColumnFilter", resizable: true }}
            domLayout="autoHeight"
          />
        </div>
      )}
    </Box>
  );
}
