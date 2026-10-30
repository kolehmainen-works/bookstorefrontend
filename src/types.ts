export interface Category {
  id: number;
  name: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string;
  publicationYear: number;
  price: number | null;
  category: Category | null;
  // the user who added the book
  ownerUsername: string | null;
}

// what the form sends: no id, and only the id of the category
export interface BookInput {
  title: string;
  author: string;
  isbn: string;
  publicationYear: number;
  price: number | null;
  category: { id: number } | null;
}

// response of POST /api/auth/login
export interface LoginResponse {
  token: string;
  expiresAt: string;
  username: string;
  roles: string[];
}

export interface MessageResponse {
  message: string;
}
