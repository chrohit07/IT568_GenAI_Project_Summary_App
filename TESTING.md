Here is the complete, streamlined **TESTING.md**. It follows your specific folder structure and uses simple step-by-step commands that you can copy and paste.

# ◈ SummaryBot

## 📁 Project Structure
```text
summarybot/
├── client/                 # React Frontend (Vite)
│   ├── cypress/            # End-to-End Testing
│   │   ├── e2e/
│   │   │   └── spec.cy.js  # Main Test Suite
│   │   └── support/
│   ├── src/                # Application Source
│   │   ├── App.jsx         # Core Logic & Socket Handling
│   │   ├── App.module.css  # Component Styling
│   │   └── main.jsx        # Entry Point
│   ├── cypress.config.js
│   └── vite.config.js
├── server/                 # Node.js Backend (Express)
│   ├── .env                # Environment Variables
│   ├── index.js            # Socket.io & AI Logic
│   └── package.json
├── package.json            # Root Manager (Concurrently)
└── README.md
```

---

## 🛠 1. Installation

Run these commands in order to install all necessary parts:

### Install Root
```bash
npm install
```

### Install Server
```bash
cd server
npm install
cd ..
```

### Install Client
```bash
cd client
npm install
cd ..
```

---

## 🔑 2. Environment Setup
Create a `.env` file inside the `server` folder:
```bash
# server/.env
PORT=3000
MONGODB_URI=your_mongodb_uri
GROQ_API_KEY=your_groq_key
```

---

## 🚀 3. Run the Project
From the **root folder**, start the backend and frontend together:
```bash
npm run dev
```
*Wait for the terminal to show the app is running on http://localhost:5173.*

---

## 🧪 4. Run Interactive Tests
Open a **new terminal** window and run these commands to open the Cypress GUI:

```bash
cd client
npx cypress open
```

**Inside the Cypress window:**
1. Select **E2E Testing**.
2. Choose your preferred browser (e.g., Chrome).
3. Click **Start E2E Testing**.
4. Click on **spec.cy.js** to run the tests.

---

## 📜 Quick Command Reference
| Task | Commands |
| :--- | :--- |
| **Start All** | `npm run dev` |
| **Open Tests** | `cd client` then `npx cypress open` |
| **Run Tests (CLI)**| `cd client` then `npx cypress run` |
