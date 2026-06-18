import { Navigate, useParams } from 'react-router-dom'

/** Legacy URL — competitions open on the play page after form save. */
export function CompetitionRun() {
  const { id } = useParams()
  if (!id) return <Navigate to="/competitive" replace />
  return <Navigate to={`/competitions/${id}`} replace />
}
