import React, { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { getInventoryItems } from '../lib/api';
import type { InventoryItem } from '../lib/types';

export default function InventoryClean(): JSX.Element {
  const { t } = useTranslation();
  const [items, setItems] = useState<InventoryItem[]>([]);

  useEffect(() => {
    let mounted = true;
    getInventoryItems()
      .then((data) => { if (mounted) setItems(data || []); })
      .catch((err) => console.error(err));
    return () => { mounted = false; };
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">{t('inventory.title')}</h2>
      {items.length === 0 ? (
        <div className="text-sm text-gray-500">{t('inventory.noItems')}</div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="p-2 border rounded bg-white">
              <div className="font-medium">{it.name || it.sku || it.id}</div>
              <div className="text-sm text-gray-500">{t('inventory.qty')} {it.quantity}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
