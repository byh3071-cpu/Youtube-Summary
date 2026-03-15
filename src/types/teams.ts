/** 팀 행 (DB) */
export type TeamRow = {
  id: string;
  name: string;
  plan: string;
  goal_text: string | null;
  created_at: string;
};

/** 팀 멤버 행 (DB) */
export type TeamMemberRow = {
  team_id: string;
  user_id: string;
  role: string;
};

/** 팀 멤버 목록 조회용 (team_id, role만) */
export type TeamMemberSummary = { team_id: string; role: string };

/** 팀 초대 행 (DB) */
export type TeamInviteRow = {
  id: string;
  team_id: string;
  email: string;
  expires_at: string;
};

/** 목록/설정용 팀 (역할 포함) */
export type TeamWithRole = TeamRow & { role: string };

/** 팀 역할이 owner 또는 admin인지 */
export function canManageTeam(role: string): boolean {
  return role === "owner" || role === "admin";
}
