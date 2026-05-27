import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { AnalysisPage } from "../pages/AnalysisPage";
import { AdminPage } from "../pages/AdminPage";
import { DashboardPage } from "../pages/DashboardPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />
      },
      {
        path: "admin",
        element: <AdminPage />
      },
      {
        path: "analysis",
        element: <AnalysisPage />
      }
    ]
  }
]);
