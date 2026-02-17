'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, Loader2, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/components/layout/toast-provider';
import { useCardGroups } from '@/lib/hooks/use-card-groups';
import { useUploadLogs } from '@/lib/hooks/use-upload-logs';
import type { CardBrandGroup } from '@/lib/types/card-group';

const ALL_BRANDS = ['JCB', 'VISA', 'Mastercard', 'AMEX', 'Diners', 'その他'];

interface GroupForm {
  id?: string;
  group_name: string;
  brands: string[];
}

export default function SettingsPage() {
  const { groups, loading: groupsLoading, upsert, remove } = useCardGroups();
  const { logs, loading: logsLoading } = useUploadLogs();
  const { showToast } = useToast();

  const [editDialog, setEditDialog] = useState(false);
  const [form, setForm] = useState<GroupForm>({ group_name: '', brands: [] });
  const [deleteTarget, setDeleteTarget] = useState<CardBrandGroup | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-8">
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
              <div className="mt-2 space-y-2">
                {ALL_BRANDS.map((brand) => {
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
