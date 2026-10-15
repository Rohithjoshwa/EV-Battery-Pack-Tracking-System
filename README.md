# EV Battery Pack Tracking System - Java Backend Version

This version changes the backend from **Node.js/Express** to **Java**.
The React frontend is kept the same and connects to the Java backend at `http://localhost:5000/api`.

## Login
Email: `admin@evtrack.com`  
Password: `1234`

## Requirements
- Java JDK 17 or above
- Node.js LTS

## Easy Run Steps
1. Extract the ZIP file.
2. Open the extracted folder.
3. Double-click `run-project.bat`.
4. Open: `http://localhost:5173`

## Manual Run Steps
Open CMD in the project folder and run:

```bash
npm install
npm start
```

## Backend Only
```bash
cd backend
javac JavaBackend.java
java JavaBackend
```

## What Changed
- Removed Node.js backend files.
- Added pure Java backend using `HttpServer`.
- Same API routes are supported:
  - Login/Register
  - Generate Pack ID
  - Add/Edit/Delete Battery Pack
  - Dashboard
  - Alerts
  - Suppliers
  - Maintenance
  - Battery History

## Note
The Java backend uses in-memory sample data for easy running, so it does not need MySQL setup or a database password.
