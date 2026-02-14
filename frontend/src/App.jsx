import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Activities from "./pages/Activities";
import MyCertificates from "./pages/MyCertificates"; // ✅ IMPORTA A PÁGINA

import OrgDashboard from "./pages/OrgDashboard";
import OrgProfile from "./pages/OrgProfile";
import OrgEditProfile from "./pages/OrgEditProfile";
import StudentActivityDetails from "./pages/StudentActivityDetails";
import CreateActivity from "./pages/CreateActivity";
import OrgActivityDetails from "./pages/OrgActivityDetails";
import ActivityParticipants from "./pages/ActivityParticipants";
import EditActivity from "./pages/EditActivity";
import MyOrgActivities from "./pages/MyOrgActivities";
import MyActivities from "./pages/MyActivities";
import PrivateRoute from "./routes/PrivateRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />

        {/* =====================
            PÚBLICO
        ===================== */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* =====================
            ALUNO
        ===================== */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute role="student">
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/activities"
          element={
            <PrivateRoute role="student">
              <Activities />
            </PrivateRoute>
          }
        />

        {/* ✅ ROTA QUE ESTAVA FALTANDO */}
        <Route
          path="/my-certificates"
          element={
            <PrivateRoute role="student">
              <MyCertificates />
            </PrivateRoute>
          }
        />

        {/* =====================
            ONG
        ===================== */}
        <Route
          path="/org"
          element={
            <PrivateRoute role="organization">
              <OrgDashboard />
            </PrivateRoute>
          }
        />

        <Route
          path="/org/profile"
          element={
            <PrivateRoute role="organization">
              <OrgProfile />
            </PrivateRoute>
          }
        />

        <Route
          path="/org/profile/edit"
          element={
            <PrivateRoute role="organization">
              <OrgEditProfile />
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
          path="/org/my-activities"
          element={
            <PrivateRoute role="organization">
              <MyOrgActivities />
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
          path="/org/activity/:id/edit"
          element={
            <PrivateRoute role="organization">
              <EditActivity />
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

        <Route path="/my-activities" element={<MyActivities />} />
        
        <Route path="/student/activity/:id" element={<StudentActivityDetails />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
