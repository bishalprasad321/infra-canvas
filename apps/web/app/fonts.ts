import { Geist } from 'next/font/google';

// Display font for the landing page hero headline only — the rest of the
// app keeps the Inter/JetBrains Mono stack defined in globals.css.
// Geist is Vercel's professional grotesk, standard across modern SaaS
// design systems (ships as an official Figma community file).
export const heroDisplayFont = Geist({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});
