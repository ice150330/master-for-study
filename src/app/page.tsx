import { Suspense } from 'react';
import { Chat } from '@/components/chat/Chat';

export default function Home() {
  return (
    <Suspense fallback={null}>
      <Chat />
    </Suspense>
  );
}
