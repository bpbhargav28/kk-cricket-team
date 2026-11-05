import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { isSupabaseConfigured } from './lib/supabase'
import { ConfigNotice } from './components/ConfigNotice'
import { DemoBadge } from './components/DemoBadge'
import { AppShell } from './components/layout/AppShell'
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from './components/auth/RouteGuards'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import CreateMatch from './pages/CreateMatch'
import EditMatch from './pages/EditMatch'
import Payments from './pages/Payments'
import History from './pages/History'
import Players from './pages/Players'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

export default function App() {
  // Without the Supabase env vars nothing can work, so explain instead of failing.
  if (!isSupabaseConfigured) return <ConfigNotice />

  return (
    // `basename` keeps every route working under the /kk-cricket-team/ sub-path
    // that GitHub Pages serves the app from. Vite injects it as BASE_URL.
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ToastProvider>
        <AuthProvider>
          <DemoBadge />
          <Routes>
            {/* ------------------------- Public ------------------------- */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>

            {/*
              Not inside PublicOnlyRoute: Supabase's recovery link signs the user
              in with a temporary session, so this route must stay reachable
              while authenticated.
            */}
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ------------------------ Signed in ----------------------- */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Dashboard />} />
                <Route path="matches" element={<Matches />} />
                <Route path="matches/:matchId" element={<MatchDetail />} />
                <Route path="payments" element={<Payments />} />
                <Route path="history" element={<History />} />
                <Route path="players" element={<Players />} />
                <Route path="profile" element={<Profile />} />

                {/* --------------------- Admin only -------------------- */}
                <Route element={<AdminRoute />}>
                  <Route path="create-match" element={<CreateMatch />} />
                  <Route path="matches/:matchId/edit" element={<EditMatch />} />
                </Route>

                {/*
                  Catch-all. Signed-out visitors never reach it — ProtectedRoute
                  sends them to /login first — so it only renders for a genuinely
                  unknown path.
                */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
