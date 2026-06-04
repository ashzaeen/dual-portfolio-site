import Navbar from "@/components/shared/Navbar";
import NotionBlocks from "@/components/professional/notion/NotionBlocks";
import BackButton from "@/components/shared/BackButton";
import Footer from "@/components/professional/Footer";
import { fetchCopyrightContent, fetchProFooter } from "@/lib/notion";

// Shared copyright page. Linked from both pro and personal footers but
// always rendered with the pro theme (gold/obsidian). Content lives in a
// single Notion page (id from NOTION_COPYRIGHT_PAGE_ID) so editing the
// page in Notion updates the route — no DB row to manage.
export const revalidate = process.env.NODE_ENV === "development" ? 0 : 3600;

export default async function CopyrightPage() {
  const [blocks, footer] = await Promise.all([
    fetchCopyrightContent(),
    fetchProFooter(),
  ]);

  return (
    <div className="theme-root" data-theme="pro">
      <Navbar />
      <main className="bg-obsidian py-20 px-6 md:px-12">
        <div className="max-w-3xl mx-auto">

          <BackButton className="font-mono text-[10px] text-text-dim hover:text-gold uppercase tracking-widest mb-12 inline-flex items-center gap-2 transition-colors cursor-pointer">
            ← Back
          </BackButton>

          <header className="mb-12">
            <div className="text-gold font-mono text-xs tracking-[0.20em] mb-1.5 uppercase">✦ The Fine Print</div>
            <h1 className="text-4xl md:text-5xl font-serif italic font-semibold text-text leading-tight">Usage &amp; Copyright</h1>
            <div className="w-11 h-px mt-2.5" style={{ background: "linear-gradient(90deg,#c4a050,transparent)" }} />
          </header>

          {blocks.length === 0 ? (
            <p className="font-mono text-xs text-text-dim/60">
              Copyright content unavailable. Set <code className="text-gold">NOTION_COPYRIGHT_PAGE_ID</code> and
              share the page with the <code className="text-gold">Portfolio SIte</code> integration.
            </p>
          ) : (
            <article className="copyright-article">
              <NotionBlocks blocks={blocks} />
            </article>
          )}
        </div>
      </main>
      <Footer config={footer.config} socials={footer.socials} />
    </div>
  );
}
