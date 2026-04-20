# 🩺 MediWise - AI Healthcare Platform

MediWise is a modern, AI-powered healthcare application designed to help users instantly understand their medications, scan complex prescriptions, check for dangerous drug interactions, and securely manage their personal medicine cabinets.

![MediWise Banner](https://via.placeholder.com/1000x400?text=MediWise+AI+Healthcare)

## ✨ Core Features

*   **🔍 AI Medicine Search**: Instantly look up any medicine to get its uses, side effects, and FDA warnings, powered by sub-second AI.
*   **📸 Prescription Scanner (OCR + AI)**: Upload an image of a prescription. Our backend uses Tesseract OCR and Groq AI to automatically extract medicine names and dosages.
*   **🛡️ Interaction Checker**: Add multiple medicines to a virtual tray and check for potential adverse drug interactions. Features a dynamic risk indicator dial (Safe / Moderate / High).
*   **💊 Personal Cabinet**: A secure, cloud-synced digital medicine cabinet to keep track of your daily medications.
*   **🔐 Google Authentication**: Secure, one-click sign-in powered by Firebase Auth.

---

## 🏗️ Architecture

MediWise uses a **Production-Grade Hybrid Architecture** to ensure maximum performance and security.

### Frontend (React + Vite)
*   Handles the stunning, Apple-inspired UI (glassmorphism, Framer Motion animations).
*   **Firebase Auth**: Manages Google Logins directly on the client.
*   **Firebase Firestore**: Reads and writes to the user's personal medicine cabinet using a secure subcollection architecture (`medicines/{userId}/items`).

### Backend (Node.js + Express)
*   Acts as a secure vault for our AI and OCR logic.
*   **Groq AI**: Handles high-speed natural language processing for drug data. The `GROQ_API_KEY` is securely hidden here.
*   **Tesseract.js**: Performs heavy optical character recognition on uploaded prescription images, keeping the frontend fast and lightweight.

---

## 📂 Project Structure

```text
Medivora/
├── frontend/               # React + Vite Frontend
│   ├── src/
│   │   ├── components/     # UI Components (Navbar, ChatFab, AuthModal)
│   │   ├── pages/          # Application Pages (Home, Cabinet, Scan, etc.)
│   │   ├── firebase.js     # Firebase SDK initialization
│   │   ├── index.css       # Global design system and glassmorphism tokens
│   │   └── App.jsx         # Main routing
│   ├── package.json
│   └── vite.config.js
│
└── backend/                # Node.js + Express Backend
    ├── server.js           # API Endpoints (/api/search, /api/scan, /api/interactions)
    ├── package.json
    └── .env                # Secret environment variables (Groq Key)
```

---

## 📸 Screenshots

*(Replace the placeholder links below with actual screenshots of your app!)*

### 🏠 Home Dashboard
![Home Dashboard](https://via.placeholder.com/800x450?text=Home+Dashboard+Screenshot)

### 📸 AI Prescription Scanning
![Prescription Scan](https://via.placeholder.com/800x450?text=Prescription+Scan+Screenshot)

### 🛡️ Drug Interaction Checker
![Interaction Checker](https://via.placeholder.com/800x450?text=Interaction+Checker+Screenshot)

### 💊 Personal Medicine Cabinet
![My Cabinet](https://via.placeholder.com/800x450?text=My+Cabinet+Screenshot)

---

## 🚀 Getting Started Locally

### 1. Backend Setup
1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder and add your Groq API Key:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   ```
4. Start the backend server:
   ```bash
   node server.js
   ```

### 2. Frontend Setup
1. Open a **new** terminal window and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update your `src/firebase.js` with your active Firebase Config block.
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173` in your browser!

---

## 👨‍💻 Author
**Raghav Sharma**
© 2026 Raghav Sharma. All rights reserved.
