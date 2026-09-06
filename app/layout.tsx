import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'NEON RIFT — закрой разлом',
  description:
    'Неоновая аркада на выживание: ручной огонь, рельсотрон, импульс и перегрев. Десять волн, восемь улучшений, два босса. Играй с клавиатуры или телефона.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className="dark">
      <body>{children}</body>
    </html>
  );
}
