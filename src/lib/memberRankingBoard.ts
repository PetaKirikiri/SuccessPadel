import { memberGender, type DirectoryMember } from './memberDirectory'
export type RankingBoard = 'all' | 'men' | 'women'
export function eligibleForRanking(member: DirectoryMember, board: RankingBoard) {
  return member.residency_status === 'local' && (board === 'all' || memberGender(member.gender) === (board === 'men' ? 'Men' : 'Women'))
}
