import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { AdminPage } from "../pages/AdminPage";
import { DashboardPage } from "../pages/DashboardPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";

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
        path: "analytics",
        element: (
          <PlaceholderPage
            title="Analytics"
            description="This area is reserved for deeper reporting and cross-machine trend analysis."
          />
        )
      },
      {
        path: "operations",
        element: (
          <PlaceholderPage
            title="Operations"
            description="Use this space for work-center detail, queue visibility, and operator workflows."
          />
        )
      },
      {
        path: "admin",
        element: <AdminPage />
      }
    ]
  }
]);
