export function AdminPagination({ page, pageCount, total, onPage }: { page: number; pageCount: number; total: number; onPage: (page: number) => void }) {
  if (pageCount <= 1) return <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{total.toLocaleString()} results</div>
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
    <span>{total.toLocaleString()} results · Page {page} of {pageCount}</span>
    <div className="flex gap-2"><button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40">Previous</button><button disabled={page >= pageCount} onClick={() => onPage(page + 1)} className="rounded-md border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40">Next</button></div>
  </div>
}
