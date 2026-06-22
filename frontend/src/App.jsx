import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import PrivateRoute from "./routes/PrivateRoute";
import AppLayout from "./components/layout/AppLayout";
import { useAuth } from "./context/AuthContext";

// Público
import Landing from "./pages/public/Landing";
import Loading from "./components/ui/Loading";

// Auth
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));

// Aluno
const StudentDashboard = lazy(() => import("./pages/student/Dashboard"));
const Activities = lazy(() => import("./pages/student/Activities"));
const StudentActivityDetails = lazy(() => import("./pages/student/ActivityDetails"));
const MyActivities = lazy(() => import("./pages/student/MyActivities"));
const MyCertificates = lazy(() => import("./pages/student/MyCertificates"));
const EditStudentProfile = lazy(() => import("./pages/student/EditProfile"));

// ONG
const OrgDashboard = lazy(() => import("./pages/org/Dashboard"));
const OrgMyActivities = lazy(() => import("./pages/org/MyActivities"));
const CreateActivity = lazy(() => import("./pages/org/CreateActivity"));
const EditActivity = lazy(() => import("./pages/org/EditActivity"));
const OrgActivityDetails = lazy(() => import("./pages/org/ActivityDetails"));
const ActivityParticipants = lazy(() => import("./pages/org/Participants"));
const OrgProfile = lazy(() => import("./pages/org/Profile"));
const OrgEditProfile = lazy(() => import("./pages/org/EditProfile"));

// Público
const OrgPublicProfile = lazy(() => import("./pages/public/OrgPublicProfile"));
const StudentPublicProfile = lazy(() => import("./pages/public/StudentPublicProfile"));
const VerifyCertificate = lazy(() => import("./pages/public/VerifyCertificate"));

function Protected({ role, children }) {
  return <PrivateRoute role={role}>{children}</PrivateRoute>;
}

function Home() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    return <Navigate to={user?.role === "organization" ? "/org" : "/dashboard"} replace />;
  }
  return <Landing />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading label="Carregando..." />}>
        <Routes>
          {/* Público */}
          <Route path="/" element={<Home />} />
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
      </Suspense>
    </BrowserRouter>
  );
}
