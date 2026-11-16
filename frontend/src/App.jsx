import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StoryStudio from './pages/StoryStudio.jsx';
import UniverseExplorer from './pages/UniverseExplorer.jsx';
import ComicEditor from './pages/ComicEditor.jsx';
import Community from './pages/Community.jsx';
import Marketplace from './pages/Marketplace.jsx';
import CharacterStudio from './pages/CharacterStudio.jsx';
import ProjectAssistant from './pages/ProjectAssistant.jsx';
import AuthPage from './pages/AuthPage.jsx';
import { RequireAuth } from './components/auth/ProtectedRoute.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
      </Route>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="story" element={<StoryStudio />} />
          <Route path="universe" element={<UniverseExplorer />} />
          <Route path="comic" element={<ComicEditor />} />
          <Route path="characters" element={<CharacterStudio />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="assistant" element={<ProjectAssistant />} />
          <Route path="community" element={<Community />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
