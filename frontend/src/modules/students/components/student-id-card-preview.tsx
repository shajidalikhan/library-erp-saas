'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-error';
import { studentApi } from '@/modules/students/student.service';

const PREVIEW_ERROR = 'Unable to load your ID card right now.';

/** Renders the same PDF used for download so preview and export match exactly. */
export function StudentIdCardPreview({
  studentId,
  fileName,
  useMeEndpoint = false,
  showDownloadButton = true,
  onDownload,
}: {
  studentId?: string;
  fileName: string;
  /** Use `/students/me/id-card` for student portal (avoids permission issues). */
  useMeEndpoint?: boolean;
  showDownloadButton?: boolean;
  onDownload?: () => void;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const fetchPdf = useCallback(async (): Promise<Blob> => {
    if (useMeEndpoint) {
      return studentApi.downloadMyIdCard({ disposition: 'inline' });
    }
    if (!studentId) {
      throw new Error('Student id required');
    }
    return studentApi.downloadIdCard(studentId, { disposition: 'inline' });
  }, [studentId, useMeEndpoint]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchPdf()
      .then((blob) => {
        if (cancelled) return;
        if (blob.size < 100) {
          setError(PREVIEW_ERROR);
          return;
        }
        revoked = URL.createObjectURL(blob);
        setPdfUrl(revoked);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.message) {
          setError(err.message);
        } else {
          setError(PREVIEW_ERROR);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [fetchPdf]);

  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }
    setDownloading(true);
    try {
      const blob = useMeEndpoint
        ? await studentApi.downloadMyIdCard()
        : await studentApi.downloadIdCard(studentId!);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(PREVIEW_ERROR);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Skeleton className="h-[214px] w-full max-w-[340px] rounded-lg" />;
  if (error || !pdfUrl) {
    return <p className="text-sm text-muted-foreground">{error ?? PREVIEW_ERROR}</p>;
  }

  return (
    <div className="space-y-3">
      <object
        data={pdfUrl}
        type="application/pdf"
        title="Student ID card preview"
        className="h-[214px] w-full max-w-[340px] rounded-lg border bg-white shadow-sm"
      >
        <p className="p-4 text-sm text-muted-foreground">{PREVIEW_ERROR}</p>
      </object>
      {showDownloadButton ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={downloading}
          onClick={() => void handleDownload()}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden />
          {downloading ? 'Downloading…' : 'Download ID card'}
        </Button>
      ) : null}
    </div>
  );
}
