import { useState } from 'react';
import { Wand2, ImageUp, Columns3, X, Sparkles } from 'lucide-react';
import type { WizardTab } from './ShopWizardDialog';

const STORAGE_KEY = 'canteen-quickstart-dismissed-v1';

export default function QuickStartBar({
  onOpenWizard,
  onCompare,
}: {
  onOpenWizard: (tab: WizardTab) => void;
  onCompare: () => void;
}) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
  };

  return (
    <div className="quickstart-bar" role="region" aria-label="新店起步引导">
      <div className="quickstart-copy">
        <Sparkles />
        <span>
          <b>站在刚租下的铺位里？</b>
          输入长宽与业态，10 秒生成属于你的 2D 平面 + 多角度 3D 效果图
        </span>
      </div>
      <div className="quickstart-actions">
        <button type="button" className="qs-primary" onClick={() => onOpenWizard('auto')}>
          <Wand2 />输入我的铺位尺寸
        </button>
        <button type="button" onClick={() => onOpenWizard('underlay')}>
          <ImageUp />上传户型图
        </button>
        <button type="button" onClick={onCompare}>
          <Columns3 />换一种摆法对比
        </button>
        <button type="button" className="qs-close" aria-label="收起新手引导" title="收起引导" onClick={dismiss}>
          <X />
        </button>
      </div>
    </div>
  );
}
