import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import StoryStudio from './pages/StoryStudio.jsx';
import UniverseExplorer from './pages/UniverseExplorer.jsx';
import ComicEditor from './pages/ComicEditor.jsx';
import Community from './pages/Community.jsx';
import Marketplace from './pages/Marketplace.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="story" element={<StoryStudio />} />
        <Route path="universe" element={<UniverseExplorer />} />
        <Route path="comic" element={<ComicEditor />} />
        <Route path="community" element={<Community />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
