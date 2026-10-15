#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Compiling Java backend..."
javac JavaBackend.java || { echo "Java compile failed. Install JDK 17 or above."; exit 1; }
echo "Starting Java backend on http://localhost:5000"
java JavaBackend
