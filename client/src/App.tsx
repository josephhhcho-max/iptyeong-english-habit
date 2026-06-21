import { Navigate, Route, Routes } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Today from './pages/Today';
import Conversation from './pages/Conversation';
import Writing from './pages/Writing';
import Review from './pages/Review';
import ExpressionDetail from './pages/ExpressionDetail';
import Flashcards from './pages/Flashcards';
import Saved from './pages/Saved';
import History from './pages/History';

export default function App() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100">
      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/today" element={<Today />} />
          <Route path="/conversation" element={<Conversation />} />
          <Route path="/writing" element={<Writing />} />
          <Route path="/review" element={<Review />} />
          <Route path="/review/:weekKey" element={<Flashcards />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/history" element={<History />} />
          <Route path="/expression/:id" element={<ExpressionDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}
