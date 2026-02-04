import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Activities from "./pages/Activities";
import OrgDashboard from "./pages/OrgDashboard";
import CreateActivity from "./pages/CreateActivity";
import OrgActivityDetails from "./pages/OrgActivityDetails";
import ActivityParticipants from "./pages/ActivityParticipants";
import EditActivity from "./pages/EditActivity";
import MyCertificates from "./pages/MyCertificates"; // ⬅ NOVO

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

        {/* ======================
            Acesso ALUNO
        ====================== */}
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

        {/* 🔥 NOVA ROTA – CERTIFICADOS DO ALUNO */}
        <Route
          path="/my-certificates"
          element={
            <PrivateRoute>
              <MyCertificates />
            </PrivateRoute>
          }
        />

        {/* ======================
            Acesso ONG
        ====================== */}
        <Route
          path="/org"
          element={
            <PrivateRoute role="organization">
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

        <Route
          path="/org/activity/:id"
          element={
            <PrivateRoute role="organization">
              <OrgActivityDetails />
            </PrivateRoute>
          }
        />

        <Route
          path="/org/activity/:id/participants"
          element={
            <PrivateRoute role="organization">
              <ActivityParticipants />
            </PrivateRoute>
          }
        />

        <Route
          path="/org/activity/:id/edit"
          element={
            <PrivateRoute role="organization">
              <EditActivity />
            </PrivateRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
