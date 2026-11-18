import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import PlayersPage from './pages/PlayersPage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import ComparePage from './pages/ComparePage'
import MatchupPage from './pages/MatchupPage'
import PredictPage from './pages/PredictPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/players/:id" element={<PlayerProfilePage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/matchup" element={<MatchupPage />} />
        <Route path="/predict" element={<PredictPage />} />
      </Route>
    </Routes>
  )
}
