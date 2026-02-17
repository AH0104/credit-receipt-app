'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, UserRole } from '@/lib/types/user-profile';
import { ROLE_PERMISSIONS } from '@/lib/types/user-profile';

export function useUserProfile() {
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    setProfile(data as UserProfile | null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const permissions = useMemo(() => {
    if (!profile) return ROLE_PERMISSIONS.viewer;
    return ROLE_PERMISSIONS[profile.role];
  }, [profile]);

  const isAdmin = profile?.role === 'admin';
  const isEditor = profile?.role === 'editor' || isAdmin;

  return { profile, loading, permissions, isAdmin, isEditor, refetch: fetch };
}

export function useUserManagement() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: true });
    setUsers((data as UserProfile[] | null) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateRole = async (userId: string, role: UserRole) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', userId);
    if (error) throw error;
    await fetch();
  };

  const toggleActive = async (userId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: isActive })
      .eq('id', userId);
    if (error) throw error;
    await fetch();
  };

  const updateDisplayName = async (userId: string, displayName: string) => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ display_name: displayName })
      .eq('id', userId);
    if (error) throw error;
    await fetch();
  };

  const createUser = async (loginId: string, password: string, displayName: string, role: UserRole) => {
    const res = await window.fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, password, displayName, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await fetch();
    return data;
  };

  const deleteUser = async (userId: string) => {
    const res = await window.fetch(`/api/admin/users?id=${userId}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await fetch();
    return data;
  };

  return { users, loading, refetch: fetch, updateRole, toggleActive, updateDisplayName, createUser, deleteUser };
}
