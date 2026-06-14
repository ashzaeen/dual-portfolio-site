export const metadata = { robots: { index: true, follow: true, noimageindex: true } };

export default function ProLayout({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
