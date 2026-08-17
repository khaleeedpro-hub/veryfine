import React from 'react';
import { PaginatedUserTable, UserRecord } from './PaginatedUserTable';

interface AdminUsersTabProps {
  users: any[];
  isLoading: boolean;
  token?: string | null;
  onRefresh: () => void;
  onInspectUser: (user: any) => void;
  onOpenAdjustBalance: (user: any) => void;
  onToggleSuspend: (userId: string, isCurrentlySuspended: boolean) => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  isLoading,
  token,
  onRefresh,
  onInspectUser,
  onOpenAdjustBalance,
  onToggleSuspend,
}) => {
  return (
    <PaginatedUserTable
      initialUsers={users as UserRecord[]}
      token={token}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onInspectUser={onInspectUser}
      onOpenAdjustBalance={onOpenAdjustBalance}
      onToggleSuspend={onToggleSuspend}
      initialPageSize={10}
      enableRealtimeListener={false}
    />
  );
};
