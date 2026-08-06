import { FormEvent, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { AdminUser, AdminUserRole, adminCreateUser, adminListUsers, adminUpdateUser } from '@/features/admin/admin'
import { cn } from '@/lib/utils'

export default function AdminUsersPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [search, setSearch] = useState('')
  const [role, setRole] = useState<AdminUserRole | ''>('')
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all')

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [createRole, setCreateRole] = useState<AdminUserRole>('staff')
  const [phone, setPhone] = useState('')

  const limit = 20

  const query = useMemo(
    () => ({
      search: search.trim() || undefined,
      role: role || undefined,
      isActive: active === 'all' ? undefined : active === 'true',
      page,
      limit,
    }),
    [active, page, role, search],
  )

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminListUsers(query)
      setItems(res.items)
      setTotal(res.total)
      setPage(res.page)
    } catch {
      toast.error('Không tải được danh sách user.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [query])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password) return
    try {
      await adminCreateUser({ name: name.trim(), email: email.trim(), password, role: createRole, phone: phone.trim() || undefined })
      toast.success('Tạo tài khoản thành công.')
      setName('')
      setEmail('')
      setPassword('')
      setPhone('')
      setCreateOpen(false)
      await load()
    } catch {
      toast.error('Tạo tài khoản thất bại. Email có thể đã tồn tại.')
    }
  }

  const onChangeRole = async (id: string, nextRole: AdminUserRole) => {
    try {
      await adminUpdateUser(id, { role: nextRole })
      toast.success('Cập nhật role thành công.')
      await load()
    } catch {
      toast.error('Cập nhật role thất bại.')
    }
  }

  const onToggleActive = async (id: string, next: boolean) => {
    try {
      await adminUpdateUser(id, { isActive: next })
      toast.success(next ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản.')
      await load()
    } catch {
      toast.error('Cập nhật trạng thái thất bại.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        right={
          <button
            className="inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            onClick={() => setCreateOpen((v) => !v)}
            type="button"
          >
            Create user
          </button>
        }
      />

      {createOpen ? (
        <form className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Name</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setName(e.target.value)}
                value={name}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Email</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Password</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                value={password}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Vai trò</div>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setCreateRole(e.target.value as AdminUserRole)}
                value={createRole}
              >
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Phone Number(optional)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setPhone(e.target.value)}
                value={phone}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800"
              type="submit"
            >
              Create
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              onClick={() => setCreateOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</div>  
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Name or email..."
              value={search}
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setRole(e.target.value as any)
                setPage(1)
              }}
              value={role}
            >
              <option value="">All</option>
              <option value="customer">Customer</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setActive(e.target.value as any)
                setPage(1)
              }}
              value={active}
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-blue-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100/40 text-[11px] font-bold uppercase tracking-wider text-blue-900/70">
              <tr>
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Email</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/60">
              {items.map((u) => (
                <tr key={u.id} className="transition hover:bg-blue-50/30">
                  <td className="px-5 py-4 font-semibold text-slate-900">{u.name}</td>
                  <td className="px-5 py-4 text-slate-700">{u.email}</td>
                  <td className="px-5 py-4">
                    <select
                      className="h-9 rounded-xl bg-white px-3 text-sm outline-none ring-1 ring-blue-200 transition focus:ring-4 focus:ring-orange-400/40"
                      onChange={(e) => onChangeRole(u.id, e.target.value as AdminUserRole)}
                      value={u.role}
                    >
                      <option value="customer">Customer</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                        u.isActive
                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
                          : 'bg-orange-50 text-orange-800 ring-1 ring-inset ring-orange-200',
                      )}
                    >
                      {u.isActive ? 'Hoạt động' : 'Khóa'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      className={cn(
                        'inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold transition',
                        u.isActive
                          ? 'bg-white text-orange-700 ring-1 ring-inset ring-orange-200 hover:bg-orange-50'
                          : 'bg-emerald-600 text-white shadow hover:bg-emerald-700',
                      )}
                      onClick={() => onToggleActive(u.id, !u.isActive)}
                      type="button"
                    >
                      {u.isActive ? 'Inactive' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-600" colSpan={5}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            {loading ? 'Đang tải...' : `Tổng: ${total}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Trước
            </button>
            <div className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-blue-900 px-3 text-sm font-bold text-white shadow">
              {page}/{totalPages}
            </div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
