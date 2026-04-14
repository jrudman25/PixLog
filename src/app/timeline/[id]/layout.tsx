import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const params = await paramsPromise;
    const supabase = await createClient();

    const { data: timeline } = await supabase
      .from('timelines')
      .select('name, description, cover_image_url')
      .eq('id', params.id)
      .single();

    if (!timeline) {
      return {
        title: 'Timeline Not Found',
      };
    }

    const title = `${timeline.name} | PixLog`;
    const description = timeline.description || 'A shared photo timeline on PixLog.';

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
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
      title: 'Timeline | PixLog',
    };
  }
}

export default function TimelineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
