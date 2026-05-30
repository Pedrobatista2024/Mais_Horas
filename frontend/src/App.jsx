import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import PrivateRoute from "./routes/PrivateRoute";
import AppLayout from "./components/layout/AppLayout";

// Auth
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Aluno
import StudentDashboard from "./pages/student/Dashboard";
import Activities from "./pages/student/Activities";
import StudentActivityDetails from "./pages/student/ActivityDetails";
import MyActivities from "./pages/student/MyActivities";
import MyCertificates from "./pages/student/MyCertificates";
import EditStudentProfile from "./pages/student/EditProfile";

// ONG
import OrgDashboard from "./pages/org/Dashboard";
import OrgMyActivities from "./pages/org/MyActivities";
import CreateActivity from "./pages/org/CreateActivity";
import EditActivity from "./pages/org/EditActivity";
import OrgActivityDetails from "./pages/org/ActivityDetails";
import ActivityParticipants from "./pages/org/Participants";
import OrgProfile from "./pages/org/Profile";
import OrgEditProfile from "./pages/org/EditProfile";

// Público
import OrgPublicProfile from "./pages/public/OrgPublicProfile";
import StudentPublicProfile from "./pages/public/StudentPublicProfile";
import VerifyCertificate from "./pages/public/VerifyCertificate";

function Protected({ role, children }) {
  return <PrivateRoute role={role}>{children}</PrivateRoute>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Público */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verificar/:code" element={<VerifyCertificate />} />
        <Route path="/org/:id/public" element={<OrgPublicProfile />} />
        <Route path="/student/:id/public" element={<StudentPublicProfile />} />

        {/* Aluno (dentro do layout) */}
        <Route
          element={
            <Protected role="student">
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/dashboard" element={<StudentDashboard />} />
          <Route path="/activities" element={<Activities />} />
          <Route path="/student/activity/:id" element={<StudentActivityDetails />} />
          <Route path="/my-activities" element={<MyActivities />} />
          <Route path="/my-certificates" element={<MyCertificates />} />
          <Route path="/edit-student-profile" element={<EditStudentProfile />} />
        </Route>

        {/* ONG (dentro do layout) */}
        <Route
          element={
            <Protected role="organization">
              <AppLayout />
            </Protected>
          }
        >
          <Route path="/org" element={<OrgDashboard />} />
          <Route path="/org/my-activities" element={<OrgMyActivities />} />
          <Route path="/org/create-activity" element={<CreateActivity />} />
          <Route path="/org/activity/:id" element={<OrgActivityDetails />} />
          <Route path="/org/activity/:id/edit" element={<EditActivity />} />
          <Route path="/org/activity/:id/participants" element={<ActivityParticipants />} />
          <Route path="/org/profile" element={<OrgProfile />} />
          <Route path="/org/profile/edit" element={<OrgEditProfile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
