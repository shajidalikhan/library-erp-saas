'use client';

import Link from 'next/link';
import { Download, FileText, User } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  paymentCollectStudentRoute,
  paymentReceiptRoute,
  studentDetailRoute,
} from '@/constants/routes';
import { PERMISSIONS } from '@/constants/permissions';
import { Can } from '@/components/auth/can';
import { formatCurrency } from '@/lib/utils';
import { studentApi } from '@/modules/students/student.service';
import type { AdmissionResult } from '@/modules/students/types-admission';
import type { Student } from '@/modules/students/types';
import type { Invoice } from '@/modules/payments/types';

function asStudent(raw: AdmissionResult['student']): Student {
  return raw as unknown as Student;
}

function asInvoice(raw: AdmissionResult['invoice']): Invoice | null {
  if (!raw) return null;
  return raw as unknown as Invoice;
}

export function StudentAdmissionSuccess({ result }: { result: AdmissionResult }) {
  const student = asStudent(result.student);
  const invoice = asInvoice(result.invoice);
  const paymentId =
    (result.payment as { _id?: string } | null)?._id ??
    (result.receipt as { _id?: string } | null)?._id;

  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await studentApi.downloadIdCard(student._id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `id-card-${student.fullName.replace(/\s+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download ID card');
    } finally {
      setDownloading(false);
    }
  };

  const due = invoice?.dueAmount ?? 0;

  return (
    <Card className="border-emerald-500/30 bg-emerald-500/5 shadow-soft">
      <CardHeader>
        <CardTitle>Admission complete</CardTitle>
        <CardDescription>
          {student.fullName}
          {student.studentId ? ` (${student.studentId})` : ''} has been created.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {invoice ? (
          <div className="rounded-md border bg-background/60 p-3 text-sm">
            <p className="font-medium">Invoice</p>
            <p>
              {invoice.invoiceNumber} ·{' '}
              <span className="text-muted-foreground">{invoice.status}</span>
            </p>
            <p className="text-muted-foreground">
              Total {formatCurrency(invoice.totalAmount, 'INR')} · paid{' '}
              {formatCurrency(invoice.paidAmount, 'INR')}
              {due > 0 ? ` · due ${formatCurrency(due, 'INR')}` : ''}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={studentDetailRoute(student._id)}>
              <User className="mr-2 h-4 w-4" aria-hidden />
              View student
            </Link>
          </Button>
          <Button type="button" variant="outline" onClick={() => void download()} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {downloading ? 'Preparing…' : 'Download ID card'}
          </Button>
          {due > 0 ? (
            <Can permission={PERMISSIONS.PAYMENT_CREATE}>
              <Button variant="secondary" asChild>
                <Link href={paymentCollectStudentRoute(student._id)}>Collect remaining payment</Link>
              </Button>
            </Can>
          ) : null}
          {paymentId ? (
            <Button variant="outline" asChild>
              <Link href={paymentReceiptRoute(paymentId)}>
                <FileText className="mr-2 h-4 w-4" aria-hidden />
                Print receipt
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
