import { useNavigate } from 'react-router-dom'
import { PracticeCourt } from '../components/PracticeCourt'

export function PracticeCourtPage() {
  const navigate = useNavigate()
  return <PracticeCourt onExit={() => navigate('/friendly')} />
}
