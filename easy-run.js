const { spawn } = require("child_process");
const path = require("path");

function run(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, shell: true, stdio: "pipe" });
  child.stdout.on("data", (data) => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${label}] ${data}`));
  child.on("close", (code) => console.log(`[${label}] stopped with code ${code}`));
  return child;
}

console.log("Starting EV Battery Pack Tracking System...");
console.log("Backend changed from Node.js to Java");
console.log("Backend: http://localhost:5000");
console.log("Frontend: http://localhost:5173");
console.log("Sample login: admin@evtrack.com / 1234");

const root = __dirname;
const backendDir = path.join(root, "backend");
const frontendDir = path.join(root, "frontend");

const compile = run("java-compile", "javac", ["JavaBackend.java"], backendDir);
compile.on("close", (code) => {
  if (code !== 0) {
    console.log("Java compile failed. Install JDK 17 or above and try again.");
    return;
  }
  const backend = run("java-backend", "java", ["JavaBackend"], backendDir);
  setTimeout(() => run("frontend", "npm", ["run", "dev", "--", "--host", "0.0.0.0"], frontendDir), 1500);
  process.on("SIGINT", () => { backend.kill(); process.exit(); });
});
