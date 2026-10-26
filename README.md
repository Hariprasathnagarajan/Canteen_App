# VDart Cafe — Canteen Management System

**VDart Cafe** is an end-to-end digital canteen food ordering and token management platform built for modern corporate workplaces, enterprise teams, and campuses.

---

## 🍽️ System Overview

VDart Cafe replaces chaotic manual canteen lines and cash handling with an automated, token-first digital workflow:

- **Token Economy**: Employees and guests are allocated monthly tokens according to their shift (Day: 50, Mid: 75, Night: 100, Guest: 30).
- **Atomic Concurrency Protection**: High-volume lunchtime orders are protected by database row-level locks (`select_for_update`) within atomic transactions to prevent double-spending.
- **Kitchen Display & Pass**: Counter staff review real-time tickets, approve dishes into the kitchen queue, and complete order pickups.
- **Automated Idempotent Refunds**: Any order declined by the counter automatically refunds tokens directly back to the employee's monthly wallet.
- **Dual Password Reset Architecture**:
  1. *Public Self-Service Reset*: Employees and staff reset their own passwords using registered email verification.
  2. *Admin-Approval Reset*: Users request an admin reset; once approved, their default password is automatically restored to their Employee ID.
- **Role-Based Security**: Segregated portals and access controls for Administrators, Kitchen Staff, Employees, and Guests.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, JavaScript, Tailwind CSS, Framer Motion, Lucide Icons, Axios, React Router, React Toastify |
| **Backend** | Python 3.12, Django 5.2, Django REST Framework 3.16 |
| **Database** | PostgreSQL (Production on Render) / SQLite (Local Development) |
| **Security** | Session Authentication, SameSite/Secure Cookies, CSRF Protection, CORS Origin Whitelisting |
| **Hosting** | Netlify (Frontend CDN) & Render (Backend Web Service) |

---

## 🚀 Getting Started

### Backend Setup (Django REST Framework)

```bash
# Activate virtual environment
.\.venv\Scripts\activate

# Apply migrations
python canteen_backend/manage.py migrate

# Run development server
python canteen_backend/manage.py runserver 127.0.0.1:8000
```

### Frontend Setup (Vite + React)

```bash
cd canteen-frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev

# Build for production
npm run build
```

---

## 🧪 Automated Testing

Run the full automated test suite (146 test cases across all 10 core modules):

```bash
python canteen_backend/manage.py test api --verbosity=2
```

---

## 📄 License & Ownership

Copyright © 2026 VDart Cafe. All rights reserved.
