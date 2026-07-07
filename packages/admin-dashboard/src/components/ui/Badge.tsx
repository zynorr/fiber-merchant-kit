interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

const variants = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
};

export default function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    paid: { label: 'Paid', variant: 'success' },
    pending: { label: 'Pending', variant: 'warning' },
    received: { label: 'Received', variant: 'info' },
    expired: { label: 'Expired', variant: 'default' },
    cancelled: { label: 'Cancelled', variant: 'danger' },
    refunded: { label: 'Refunded', variant: 'purple' },
    Succeeded: { label: 'Succeeded', variant: 'success' },
    Failed: { label: 'Failed', variant: 'danger' },
    Pending: { label: 'Pending', variant: 'warning' },
    Timeout: { label: 'Timeout', variant: 'default' },
  };

  const c = config[status] || { label: status, variant: 'default' as BadgeProps['variant'] };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}
