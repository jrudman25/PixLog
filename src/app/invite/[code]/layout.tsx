import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  try {
    const params = await paramsPromise;
    const supabase = await createClient();

    const { data: timeline } = await supabase
      .from('timelines')
      .select('name, description, cover_image_url')
      .eq('invite_code', params.code)
      .single();

    if (!timeline) {
      return {
        title: 'Timeline Invite Not Found',
      };
    }

    const title = `You're Invited to ${timeline.name} | PixLog`;
    const description = timeline.description || `Join my shared photo timeline on PixLog.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        ...(timeline.cover_image_url && {
          images: [
            {
              url: timeline.cover_image_url,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        }),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        ...(timeline.cover_image_url && {
          images: [timeline.cover_image_url],
        }),
      },
    };
  } catch (_e) {
    return {
      title: 'Timeline Invite | PixLog',
    };
  }
}

export default function InviteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
