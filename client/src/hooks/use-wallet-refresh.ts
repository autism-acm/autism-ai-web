import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/queryClient';
import { useSession } from './use-session';

export function useWalletRefresh() {
  const { data: session } = useSession();
  const hasWallet = session?.walletAddress;

  const refreshWalletMutation = useMutation({
    mutationFn: api.wallet.refresh,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session'] });
    },
    onError: (error) => {
      console.error('Failed to refresh wallet balance:', error);
    },
  });

  useEffect(() => {
    if (!hasWallet) return;

    // Refresh wallet balance every 60 seconds
    const intervalId = setInterval(() => {
      refreshWalletMutation.mutate();
    }, 60000);

    return () => clearInterval(intervalId);
  }, [hasWallet]);

  return refreshWalletMutation;
}
