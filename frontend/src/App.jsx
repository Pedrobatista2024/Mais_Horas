import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Activities from "./pages/Activities";
import OrgDashboard from "./pages/OrgDashboard";
import CreateActivity from "./pages/CreateActivity";

import PrivateRoute from "./routes/PrivateRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Redireciona "/" para login */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Acesso público */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Acesso aluno */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/activities"
          element={
            <PrivateRoute>
              <Activities />
            </PrivateRoute>
          }
        />

        {/* Acesso ONG */}
        <Route
          path="/org"
          element={
            <PrivateRoute>
              <OrgDashboard />
            </PrivateRoute>
          }
        />
          <Route
            path="/org/create-activity"
            element={
              <PrivateRoute role="organization">
                <CreateActivity />
              </PrivateRoute>
            }
          />

          
      </Routes>
    </BrowserRouter>
  );
}

export default App;
