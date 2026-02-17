'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, Save, Loader2, FileText, Clock, Users, Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useCardGroups } from '@/lib/hooks/use-card-groups';
import { useUploadLogs } from '@/lib/hooks/use-upload-logs';
import { useTransactions } from '@/lib/hooks/use-transactions';
import { useUserProfile, useUserManagement } from '@/lib/hooks/use-user-profile';
import { ROLE_PERMISSIONS } from '@/lib/types/user-profile';
import type { CardBrandGroup } from '@/lib/types/card-group';
import type { UserRole } from '@/lib/types/user-profile';

interface GroupForm {
  id?: string;
  group_name: string;
  brands: string[];
}

interface NewUserForm {
  loginId: string;
  password: string;
  displayName: string;
  role: UserRole;
}

function extractLoginId(email: string): string {
  return email.replace(/@internal$/, '');
}

export default function SettingsPage() {
  const { groups, loading: groupsLoading, upsert, remove } = useCardGroups();
  const { logs, loading: logsLoading } = useUploadLogs();
  const { transactions, loading: txnLoading } = useTransactions();
  const { profile, isAdmin } = useUserProfile();
  const { users, loading: usersLoading, updateRole, toggleActive, createUser, deleteUser } = useUserManagement();
  const { showToast } = useToast();

  // 明細データから実際に使われているカード会社名を動的に抽出
  const allBrands = useMemo(() => {
    const brandSet = new Set<string>();
    for (const t of transactions) {
      if (t.card_brand) brandSet.add(t.card_brand);
    }
    return Array.from(brandSet).sort();
  }, [transactions]);

  const [editDialog, setEditDialog] = useState(false);
  const [form, setForm] = useState<GroupForm>({ group_name: '', brands: [] });
  const [deleteTarget, setDeleteTarget] = useState<CardBrandGroup | null>(null);
  const [saving, setSaving] = useState(false);

  // ユーザー追加ダイアログ
  const [addUserDialog, setAddUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState<NewUserForm>({ loginId: '', password: '', displayName: '', role: 'viewer' });
  const [addingUser, setAddingUser] = useState(false);

  // ユーザー削除確認
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string; name: string } | null>(null);

  // Brands already assigned to other groups (not the current one being edited)
  const assignedBrands = groups
    .filter((g) => g.id !== form.id)
    .flatMap((g) => g.brands);

  const openNewGroup = () => {
    setForm({ group_name: '', brands: [] });
    setEditDialog(true);
  };

  const openEditGroup = (g: CardBrandGroup) => {
    setForm({ id: g.id, group_name: g.group_name, brands: [...g.brands] });
    setEditDialog(true);
  };

  const toggleBrand = (brand: string) => {
    setForm((prev) => ({
      ...prev,
      brands: prev.brands.includes(brand)
        ? prev.brands.filter((b) => b !== brand)
        : [...prev.brands, brand],
    }));
  };

  const saveGroup = async () => {
    if (!form.group_name.trim() || form.brands.length === 0) {
      showToast('グループ名とブランドを入力してください');
      return;
    }
    setSaving(true);
    try {
      await upsert(form);
      showToast('保存しました');
      setEditDialog(false);
    } catch {
      showToast('保存に失敗しました');
    }
    setSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove(deleteTarget.id);
      showToast('削除しました');
    } catch {
      showToast('削除に失敗しました');
    }
    setDeleteTarget(null);
  };

  const handleRoleChange = async (userId: string, role: UserRole) => {
    try {
      await updateRole(userId, role);
      showToast('ロールを変更しました');
    } catch {
      showToast('変更に失敗しました');
    }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    try {
      await toggleActive(userId, isActive);
      showToast(isActive ? 'ユーザーを有効化しました' : 'ユーザーを無効化しました');
    } catch {
      showToast('変更に失敗しました');
    }
  };

  const handleAddUser = async () => {
    if (!newUserForm.loginId || !newUserForm.password) {
      showToast('IDとパスワードを入力してください');
      return;
    }
    setAddingUser(true);
    try {
      await createUser(newUserForm.loginId, newUserForm.password, newUserForm.displayName, newUserForm.role);
      showToast(`ユーザー ${newUserForm.loginId} を追加しました`);
      setAddUserDialog(false);
      setNewUserForm({ loginId: '', password: '', displayName: '', role: 'viewer' });
    } catch (e) {
      showToast(e instanceof Error ? e.message : '追加に失敗しました');
    }
    setAddingUser(false);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await deleteUser(deleteUserTarget.id);
      showToast('ユーザーを削除しました');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '削除に失敗しました');
    }
    setDeleteUserTarget(null);
  };

  const roleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive' as const;
      case 'editor': return 'warning' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="space-y-8">
      {/* ユーザー管理（admin のみ） */}
      {isAdmin && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5" />
                ユーザー管理
              </h2>
              <p className="text-sm text-muted mt-0.5">
                ユーザーの追加・ロール変更・有効/無効の切り替え
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddUserDialog(true)}>
              <UserPlus className="h-4 w-4 mr-1" />
              ユーザー追加
            </Button>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : (
            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs w-16">ID</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs">名前</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs">ロール</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs">状態</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs w-28">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === profile?.id;
                    const loginId = extractLoginId(u.email);
                    return (
                      <tr key={u.id} className={`border-b border-border last:border-b-0 ${!u.is_active ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-2.5 text-center font-mono font-semibold">{loginId}</td>
                        <td className="px-4 py-2.5 font-semibold">
                          <div className="flex items-center gap-2">
                            {u.display_name || '---'}
                            {isSelf && <span className="text-[10px] text-primary font-normal">(自分)</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {isSelf ? (
                            <Badge variant={roleBadgeVariant(u.role)}>{ROLE_PERMISSIONS[u.role].label}</Badge>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                              className="h-7 rounded border border-border bg-card px-2 text-xs"
                            >
                              <option value="admin">管理者</option>
                              <option value="editor">編集者</option>
                              <option value="viewer">閲覧者</option>
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant={u.is_active ? 'success' : 'secondary'}>
                            {u.is_active ? '有効' : '無効'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {!isSelf && (
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => handleToggleActive(u.id, !u.is_active)}
                                className={`text-xs px-2 py-1 rounded ${
                                  u.is_active
                                    ? 'text-accent hover:bg-accent-light'
                                    : 'text-success hover:bg-success-light'
                                }`}
                              >
                                {u.is_active ? '無効化' : '有効化'}
                              </button>
                              <button
                                onClick={() => setDeleteUserTarget({ id: u.id, name: u.display_name || loginId })}
                                className="text-xs px-2 py-1 rounded text-accent hover:bg-accent-light"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ロール説明 */}
              <div className="border-t border-border p-4 bg-background/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="h-4 w-4 text-muted" />
                  <span className="text-xs font-semibold text-muted">ロール別権限</span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {(['admin', 'editor', 'viewer'] as const).map((role) => {
                    const perm = ROLE_PERMISSIONS[role];
                    return (
                      <div key={role} className="bg-card rounded border border-border p-2.5">
                        <div className="font-semibold mb-1">
                          <Badge variant={roleBadgeVariant(role)} className="text-[10px]">{perm.label}</Badge>
                        </div>
                        <p className="text-muted leading-relaxed">{perm.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* カード会社グループ設定 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-foreground">カード会社グループ設定</h1>
            <p className="text-sm text-muted mt-0.5">入金先ごとにカード会社をグループ化。集計・照合に反映されます。</p>
          </div>
          <Button variant="outline" size="sm" onClick={openNewGroup}>
            <Plus className="h-4 w-4 mr-1" />
            新規グループ
          </Button>
        </div>

        {groupsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted">
            グループが未定義です。「新規グループ」から作成してください。
            <br />
            <span className="text-xs">例: 「VJ協」に VISA・Mastercard をまとめる</span>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs">グループ名</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs">所属ブランド</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id} className="border-b border-border last:border-b-0 hover:bg-primary-light/10">
                    <td className="px-4 py-2.5 font-semibold text-foreground">{g.group_name}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {g.brands.join('、')}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => openEditGroup(g)} className="text-xs text-primary hover:underline px-2 py-1">
                          編集
                        </button>
                        <button onClick={() => setDeleteTarget(g)} className="text-xs text-accent hover:underline px-2 py-1">
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* アップロード履歴 */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5" />
            アップロード履歴
          </h2>
          <p className="text-sm text-muted mt-0.5">過去のアップロードとOCR読取の記録</p>
        </div>

        {logsLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-sm text-muted">
            アップロード履歴はありません
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs">日時</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs">ファイル数</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs">読取件数</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-muted text-xs">保存件数</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-muted text-xs">ファイル名</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {new Date(log.uploaded_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 text-center">{log.file_count}</td>
                    <td className="px-4 py-2.5 text-center">{log.total_records}</td>
                    <td className="px-4 py-2.5 text-center font-semibold">{log.saved_records}</td>
                    <td className="px-4 py-2.5 text-muted text-xs">
                      {log.uploaded_files?.map((f) => (
                        <span key={f.id} className="inline-flex items-center gap-1 mr-2">
                          <FileText className="h-3 w-3" />
                          {f.file_name}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ユーザー追加ダイアログ */}
      <Dialog open={addUserDialog} onOpenChange={setAddUserDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ユーザーを追加</DialogTitle>
            <DialogDescription>IDとパスワードを設定してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>ユーザーID（数字3桁）</Label>
              <Input
                value={newUserForm.loginId}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                  setNewUserForm({ ...newUserForm, loginId: v });
                }}
                placeholder="例: 001"
                inputMode="numeric"
                maxLength={3}
                className="mt-1 font-mono"
              />
            </div>
            <div>
              <Label>パスワード（アルファベット1文字＋数字4桁）</Label>
              <Input
                value={newUserForm.password}
                onChange={(e) => {
                  const v = e.target.value.slice(0, 5);
                  setNewUserForm({ ...newUserForm, password: v });
                }}
                placeholder="例: A1234"
                maxLength={5}
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-muted mt-1">例: A1234, k5678</p>
            </div>
            <div>
              <Label>表示名</Label>
              <Input
                value={newUserForm.displayName}
                onChange={(e) => setNewUserForm({ ...newUserForm, displayName: e.target.value })}
                placeholder="例: 田中太郎"
                className="mt-1"
              />
            </div>
            <div>
              <Label>ロール</Label>
              <select
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as UserRole })}
                className="mt-1 w-full h-9 rounded border border-border bg-card px-3 text-sm"
              >
                <option value="viewer">閲覧者</option>
                <option value="editor">編集者</option>
                <option value="admin">管理者</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddUserDialog(false)}>キャンセル</Button>
              <Button onClick={handleAddUser} disabled={addingUser}>
                <UserPlus className="h-4 w-4 mr-1" />
                {addingUser ? '追加中...' : '追加'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ユーザー削除確認ダイアログ */}
      <Dialog open={!!deleteUserTarget} onOpenChange={() => setDeleteUserTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>ユーザーを削除しますか？</DialogTitle>
            <DialogDescription>
              「{deleteUserTarget?.name}」を完全に削除します。この操作は取り消せません。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteUserTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDeleteUser}>削除する</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* グループ編集ダイアログ */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.id ? 'グループを編集' : '新規グループ'}</DialogTitle>
            <DialogDescription>グループ名と所属するカード会社を選択してください</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>グループ名</Label>
              <Input
                value={form.group_name}
                onChange={(e) => setForm({ ...form, group_name: e.target.value })}
                placeholder="例: VJ協"
                className="mt-1"
              />
            </div>
            <div>
              <Label>所属ブランド</Label>
              {allBrands.length === 0 ? (
                <p className="mt-2 text-xs text-muted">明細にカード会社のデータがありません。先にレシートを読み取ってください。</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {allBrands.map((brand) => {
                    const isAssigned = assignedBrands.includes(brand);
                    const isChecked = form.brands.includes(brand);
                    return (
                      <label
                        key={brand}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          isChecked ? 'bg-primary-light border-primary' : 'border-border hover:bg-background'
                        } ${isAssigned ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => !isAssigned && toggleBrand(brand)}
                          disabled={isAssigned}
                        />
                        <span className="text-sm">{brand}</span>
                        {isAssigned && <span className="text-[10px] text-muted ml-auto">他グループに所属</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialog(false)}>キャンセル</Button>
              <Button onClick={saveGroup} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>グループを削除しますか？</DialogTitle>
            <DialogDescription>
              「{deleteTarget?.group_name}」を削除します。所属ブランドは個別表示に戻ります。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>キャンセル</Button>
            <Button variant="destructive" onClick={confirmDelete}>削除する</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
