import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
import { getSignedFileUrl } from '@/lib/storageSignedUrl';

interface Props {
  fileUrl: string;
  alt: string;
  className?: string;
}

export function SignedImage({ fileUrl, alt, className }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['signed-url', fileUrl],
    queryFn: () => getSignedFileUrl(fileUrl, { expiresIn: 3600 }),
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    enabled: !!fileUrl,
  });

  if (isLoading) {
    return <div className={`${className ?? ''} bg-muted animate-pulse`} />;
  }

  if (isError || !data) {
    return (
      <div className={`${className ?? ''} flex flex-col items-center justify-center gap-1 text-muted-foreground bg-muted`}>
        <ImageOff className="h-6 w-6" />
        <span className="text-[10px] text-center px-1 leading-tight truncate max-w-full">{alt}</span>
      </div>
    );
  }

  return <img src={data} alt={alt} className={className} />;
}