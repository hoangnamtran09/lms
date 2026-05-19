"use client";

import { useEffect, useState } from "react";

interface PDFViewerProps {
  file: string | null;
  numPages: number;
  onLoadSuccess: ({ numPages }: { numPages: number }) => void;
  pdfWidth: number;
}

export default function PDFViewer({
  file,
  numPages,
  onLoadSuccess,
  pdfWidth,
}: PDFViewerProps) {
  const [Document, setDocument] = useState<any>(null);
  const [Page, setPage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!file) {
      setIsLoading(false);
      return;
    }

    const initPDF = async () => {
      try {
        const { Document: Doc, Page: Pg, pdfjs } = await import("react-pdf");
        
        // Import CSS
        await import("react-pdf/dist/Page/AnnotationLayer.css");
        await import("react-pdf/dist/Page/TextLayer.css");

        // Set worker source - using CDN
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        }

        setDocument(() => Doc);
        setPage(() => Pg);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load PDF:", error);
        setIsLoading(false);
      }
    };

    initPDF();
  }, [file]);

  if (!file) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center pt-12">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-gray-200 mx-auto" />
          <div className="h-[60vh] w-[45vh] rounded bg-gray-100" />
        </div>
      </div>
    );
  }

  if (!Document || !Page) {
    return (
      <div className="flex items-center justify-center pt-12 text-sm text-red-500">
        Không thể tải thư viện PDF
      </div>
    );
  }

  const pageCount = Math.max(0, typeof numPages === "number" ? numPages : 0);

  return (
    <Document
      file={file}
      onLoadSuccess={onLoadSuccess}
      loading={
        <div className="flex items-center justify-center pt-12">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-32 rounded bg-gray-200 mx-auto" />
            <div className="h-[60vh] w-[45vh] rounded bg-gray-100" />
          </div>
        </div>
      }
      error={
        <div className="flex items-center justify-center pt-12 text-sm text-red-500">
          Không thể tải tài liệu PDF
        </div>
      }
    >
      {pageCount > 0 &&
        Array.from({ length: pageCount }).map((_, i) => (
          <Page
            key={i + 1}
            pageNumber={i + 1}
            width={pdfWidth > 0 ? pdfWidth - 32 : undefined}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
        ))}
    </Document>
  );
}
