import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api";
import type { Book, BookInput, Category } from "../types";
import "./BookList.css";

interface FormState {
  author: string;
  title: string;
  publicationYear: string;
  categoryId: string;
  isbn: string;
  price: string;
}

const emptyForm: FormState = { author: "", title: "", publicationYear: "", categoryId: "", isbn: "", price: "" };

// addbook.html of kolehmainenbookstore: adds a new book, or edits one at /books/:id/edit
export default function BookForm() {
  const { id } = useParams();
  const editing = id !== undefined;
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const requests: [Promise<Category[]>, Promise<Book | null>] = [
      apiFetch<Category[]>("/api/categories"),
      editing ? apiFetch<Book>(`/api/books/${id}`) : Promise.resolve(null),
    ];
    Promise.all(requests)
      .then(([categoryList, book]) => {
        setCategories(categoryList);
        if (book) {
          setForm({
            author: book.author,
            title: book.title,
            publicationYear: String(book.publicationYear),
            categoryId: book.category ? String(book.category.id) : "",
            isbn: book.isbn,
            price: book.price == null ? "" : String(book.price),
          });
        } else if (categoryList.length > 0) {
          setForm((f) => ({ ...f, categoryId: String(categoryList[0].id) }));
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, editing]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const book: BookInput = {
      author: form.author.trim(),
      title: form.title.trim(),
      publicationYear: Number(form.publicationYear),
      category: form.categoryId ? { id: Number(form.categoryId) } : null,
      isbn: form.isbn.trim(),
      price: form.price === "" ? null : Number(form.price),
    };
    try {
      await apiFetch<Book>(editing ? `/api/books/${id}` : "/api/books", {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(book),
      });
      navigate("/books");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed.");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box className="loading-container">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="page narrow">
      <Typography variant="h4" component="h1" gutterBottom>
        {editing ? "Edit book" : "Add new book"}
      </Typography>
      <Paper sx={{ p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField label="Author" name="author" value={form.author} onChange={handleChange} required />
          <TextField label="Title" name="title" value={form.title} onChange={handleChange} required />
          <TextField
            label="Publication year"
            name="publicationYear"
            type="number"
            value={form.publicationYear}
            onChange={handleChange}
            required
          />
          <TextField select label="Category" name="categoryId" value={form.categoryId} onChange={handleChange}>
            {categories.map((category) => (
              <MenuItem key={category.id} value={String(category.id)}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="ISBN" name="isbn" value={form.isbn} onChange={handleChange} required />
          <TextField
            label="Price"
            name="price"
            type="number"
            inputProps={{ step: "0.01", min: 0 }}
            value={form.price}
            onChange={handleChange}
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button component={RouterLink} to="/books">
              Cancel
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
