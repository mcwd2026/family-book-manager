// 自定义封面选择器：拍照 / 相册选图，压缩后转 dataURL
"use client";
import { useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoverPickerProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}

// 压缩图片到最大边 800px 的 JPEG dataURL（约 100KB 内，适合存库）
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function CoverPicker({ value, onChange }: CoverPickerProps) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  async function onPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      onChange(await compressImage(file));
    } catch {
      alert("图片处理失败，请重试");
    }
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="封面预览" className="w-16 h-24 object-cover rounded-md border border-border" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-0.5"
            title="移除封面"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <div className="w-16 h-24 rounded-md border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
          <Camera size={20} className="opacity-50" />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => camRef.current?.click()}>
          <Camera size={14} className="mr-1" /> 拍照
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => galRef.current?.click()}>
          <ImagePlus size={14} className="mr-1" /> 从相册选取
        </Button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPicked} />
      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={onPicked} />
    </div>
  );
}
