import './globals.css';

export const metadata = {
  title: 'PatchProof — Verified Security Fixes',
  description: 'AI-generated software security patches, independently verified in isolated sandboxes.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
