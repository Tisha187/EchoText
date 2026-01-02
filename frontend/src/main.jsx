import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

console.log("=== EchoText App Starting ===");
console.log("React version:", React.version);
console.log("Browser:", navigator.userAgent);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log("=== App Rendered to DOM ===");

