import { useEffect, useRef, useState } from 'react';
import type { FurnitureSpec } from './furniture';
import { modelOf } from './model';

export default function CatalogThumbnail({ item }: { item: FurnitureSpec }) {
  const [src, setSrc] = useState('');
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const model = modelOf(item);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px' },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    let cancel: (() => void) | undefined;
    void import('./catalogThumbnailRenderer')
      .then(({ enqueueThumbnail, renderCatalogThumbnail }) => {
        if (!active) return;
        cancel = enqueueThumbnail(() => {
          try {
            const image = renderCatalogThumbnail(item);
            if (active) setSrc(image);
          } catch {
            if (active) setSrc('');
          }
        });
      })
      .catch(() => {
        if (active) setSrc('');
      });
    return () => {
      active = false;
      cancel?.();
    };
  }, [visible, model, item.w, item.d, item.h, item.color]);

  return (
    <span ref={host} className="catalog-thumb">
      {src
        ? <img className="catalog-render" src={src} alt={`${item.name}三维模型`} draggable={false} />
        : <span className="catalog-render placeholder">模型预览</span>}
    </span>
  );
}
