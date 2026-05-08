"use client";

interface Props {
  url: string;
  title: string;
}

export function PDFViewer({ url, title }: Props) {
  const proxyUrl = `/api/media/pdf?url=${encodeURIComponent(url)}`;

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      </div>
      <div className="flex-1 rounded-xl overflow-hidden ring-1 ring-foreground/10 bg-white min-h-[70vh]">
        <iframe
          src={proxyUrl}
          title={title}
          className="w-full h-full min-h-[70vh]"
        />
      </div>
    </div>
  );
}
