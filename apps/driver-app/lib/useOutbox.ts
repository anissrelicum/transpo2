import * as React from 'react';
import NetInfo from '@react-native-community/netinfo';
import { subscribe, load, flush, type Pending, type FlushResult } from './outbox';

/**
 * État de la file d'attente + connectivité. La file repart automatiquement dès
 * que le réseau revient : le livreur n'a rien à déclencher.
 */
export function useOutbox(onFlushed?: (r: FlushResult) => void) {
  const [pending, setPending] = React.useState<Pending[]>([]);
  const [online, setOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const busy = React.useRef(false);
  const cb = React.useRef(onFlushed);
  cb.current = onFlushed;

  const sync = React.useCallback(async () => {
    // Un seul vidage à la fois : sans ce verrou, un retour de réseau pendant une
    // passe rejouerait les mêmes actions en parallèle.
    if (busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const q = await load();
      if (q.length === 0) return;
      const res = await flush();
      if (res.sent > 0 || res.rejected.length > 0) cb.current?.(res);
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, []);

  React.useEffect(() => {
    const off = subscribe(setPending);
    load();
    const unsub = NetInfo.addEventListener((state) => {
      const up = state.isConnected !== false;
      setOnline(up);
      if (up) sync();
    });
    return () => { off(); unsub(); };
  }, [sync]);

  return { pending, online, syncing, sync };
}
