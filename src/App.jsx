import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Layout } from "./components/ui.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import TestList from "./pages/participant/TestList.jsx";
import TakeTest from "./pages/participant/TakeTest.jsx";
import Result from "./pages/participant/Result.jsx";
import AdminTests from "./pages/admin/AdminTests.jsx";
import AdminTestDetail from "./pages/admin/AdminTestDetail.jsx";
import AdminCourses from "./pages/admin/AdminCourses.jsx";
import Account from "./pages/Account.jsx";

function Protected({ role, wide, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return <Layout wide={wide}>{children}</Layout>;
}

function Home() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/tests"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/tests" element={<Protected role="participant"><TestList /></Protected>} />
      <Route path="/attempts/:attemptId" element={<Protected role="participant"><TakeTest /></Protected>} />
      <Route path="/attempts/:attemptId/result" element={<Protected role="participant"><Result /></Protected>} />

      <Route path="/admin" element={<Protected role="admin" wide><AdminTests /></Protected>} />
      <Route path="/admin/tests/:testId" element={<Protected role="admin" wide><AdminTestDetail /></Protected>} />
      <Route path="/courses" element={<Protected role="admin" wide><AdminCourses /></Protected>} />

      <Route path="/account" element={<Protected><Account /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
