import { Space_Grotesk } from 'next/font/google';

// Display font for the landing page hero headline only — the rest of the
// app keeps the Inter/JetBrains Mono stack defined in globals.css.
export const heroDisplayFont = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
});
