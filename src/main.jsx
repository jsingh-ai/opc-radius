import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { PageHeaderProvider } from "./context/PageHeaderContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <PageHeaderProvider>
        <RouterProvider router={router} />
      </PageHeaderProvider>
    </ThemeProvider>
  </React.StrictMode>
);
