export type UserRole = 'admin' | 'editor' | 'viewer';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * ロール別の権限定義
 * admin:  全操作可能（ユーザー管理、設定、データCRUD、照合、アーカイブ）
 * editor: データ操作可能（読取、編集、削除、照合）、ユーザー管理は不可
 * viewer: 閲覧のみ（一覧、集計、CSV出力）
 */
export const ROLE_PERMISSIONS = {
  admin: {
    label: '管理者',
    description: 'すべての機能を利用可能',
    canUpload: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canReconcile: true,
    canArchive: true,
    canManageSettings: true,
    canManageUsers: true,
  },
  editor: {
    label: '編集者',
    description: 'データの読取・編集・照合が可能',
    canUpload: true,
    canEditRecords: true,
    canDeleteRecords: true,
    canReconcile: true,
    canArchive: false,
    canManageSettings: false,
    canManageUsers: false,
  },
  viewer: {
    label: '閲覧者',
    description: '一覧・集計の閲覧とCSV出力のみ',
    canUpload: false,
    canEditRecords: false,
    canDeleteRecords: false,
    canReconcile: false,
    canArchive: false,
    canManageSettings: false,
    canManageUsers: false,
  },
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[UserRole];
