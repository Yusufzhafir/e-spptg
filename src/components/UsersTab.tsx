import { useState } from 'react';
import { User, UserRole, UserStatus, Village } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { useTableSort, SortableHead } from './table-sort';
import { formatDateTime } from '@/lib/format-date';
import { useAuthRole } from './AuthRoleProvider';
import { canManageUser, canViewUser } from '@/lib/user-access';
import { RequiredMark } from './RequiredMark';
import { SearchableSelect } from './SearchableSelect';
import { FieldError } from './FieldError';
import { createUserSchema } from '@/lib/validation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Search, Plus, Edit, Power, KeyRound } from 'lucide-react';
import { toast } from 'sonner';

interface UsersTabProps {
  users: User[];
  villages: Village[];
  canManageVillageAssignment?: boolean;
  onUpdateUsers?: (users: User[]) => void;
  onCreateUser?: (
    data: Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'nomorHP' | 'status'>
  ) => void;
  onUpdateUser?: (
    id: number,
    data: Partial<Pick<User, 'nama' | 'nipNik' | 'email' | 'peran' | 'assignedVillageId' | 'nomorHP' | 'status'>>
  ) => void;
  onToggleUserStatus?: (id: number) => void;
}

export function UsersTab({
  users,
  villages,
  canManageVillageAssignment = false,
  onUpdateUsers,
  onCreateUser,
  onUpdateUser,
  onToggleUserStatus,
}: UsersTabProps) {
  const { user: currentUser } = useAuthRole();
  const canAddUser = currentUser?.peran === 'Superadmin' || currentUser?.peran === 'Admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeactivateDialogOpen, setIsDeactivateDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errorClass = (field: string) => (errors[field] ? 'border-red-500' : undefined);
  const clearError = (field: string) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  // Filter users
  const filteredUsers = users.filter((user) => {
    // Defense-in-depth: the server already scopes the list, but never render a
    // row the current user isn't allowed to see.
    const matchesVisibility = !currentUser || canViewUser(currentUser, user);

    const matchesSearch =
      !searchQuery ||
      user.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.nipNik.includes(searchQuery);

    const matchesRole = roleFilter === 'all' || user.peran === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

    return matchesVisibility && matchesSearch && matchesRole && matchesStatus;
  });

  const {
    sorted: sortedUsers,
    sortKey,
    sortDir,
    toggleSort,
  } = useTableSort<User>(filteredUsers, (user, key) => {
    switch (key) {
      case 'nama':
        return user.nama?.toLowerCase();
      case 'nipNik':
        return user.nipNik;
      case 'email':
        return user.email?.toLowerCase();
      case 'peran':
        return user.peran;
      case 'status':
        return user.status;
      case 'terakhirMasuk':
        return user.terakhirMasuk ? new Date(user.terakhirMasuk).getTime() : 0;
      default:
        return '';
    }
  });

  const handleAddUser = () => {
    setErrors({});
    setFormData({
      peran: 'Viewer',
      assignedVillageId: null,
      status: 'Aktif',
    });
    setIsAddDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setErrors({});
    setSelectedUser(user);
    setFormData(user);
    setIsEditDialogOpen(true);
  };

  const handleDeactivateUser = (user: User) => {
    setSelectedUser(user);
    setIsDeactivateDialogOpen(true);
  };

  const validateUser = () => {
    const next: Record<string, string> = {};
    const result = createUserSchema.safeParse({
      email: formData.email ?? '',
      nama: formData.nama ?? '',
      nipNik: formData.nipNik ?? '',
      peran: formData.peran,
      assignedVillageId: formData.assignedVillageId ?? null,
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] ?? '');
        if (field && !next[field]) next[field] = issue.message;
      }
    }
    if (!formData.peran) next.peran = 'Peran wajib dipilih';
    if (
      (formData.peran === 'Admin' || formData.peran === 'Verifikator') &&
      typeof formData.assignedVillageId !== 'number'
    ) {
      next.assignedVillageId = 'Desa penugasan wajib dipilih untuk Admin/Verifikator';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSaveUser = () => {
    if (!validateUser()) {
      toast.error('Harap lengkapi field wajib yang ditandai merah');
      return;
    }

    if (onCreateUser) {
      onCreateUser({
        nama: formData.nama ?? '',
        nipNik: formData.nipNik ?? '',
        email: formData.email ?? '',
        peran: formData.peran as UserRole,
        assignedVillageId: formData.assignedVillageId ?? null,
        status: (formData.status as UserStatus) || 'Aktif',
        nomorHP: formData.nomorHP || null,
      });
    } else if (onUpdateUsers) {
      const newUser: User = {
        id: new Date().getTime(),
        nama: formData.nama ?? '',
        nipNik: formData.nipNik ?? '',
        email: formData.email ?? '',
        peran: formData.peran as UserRole,
        assignedVillageId: formData.assignedVillageId ?? null,
        status: (formData.status as UserStatus) || 'Aktif',
        nomorHP: formData.nomorHP || null,
        clerkUserId: null,
        terakhirMasuk: null,
      };
      onUpdateUsers([...users, newUser]);
    } else {
      toast.error('Penambahan pengguna tidak tersedia.');
      return;
    }
    setIsAddDialogOpen(false);
    setFormData({});
    // Success toast is shown by the create mutation's onSuccess handler.
  };

  const handleUpdateUser = () => {
    if (!selectedUser) return;

    if (!validateUser()) {
      toast.error('Harap lengkapi field wajib yang ditandai merah');
      return;
    }

    if (onUpdateUser) {
      onUpdateUser(selectedUser.id, {
        nama: formData.nama,
        nipNik: formData.nipNik,
        email: formData.email,
        peran: formData.peran as UserRole | undefined,
        assignedVillageId: formData.assignedVillageId ?? null,
        nomorHP: formData.nomorHP ?? null,
        status: formData.status as UserStatus | undefined,
      });
    } else if (onUpdateUsers) {
      const updatedUsers = users.map((u) =>
        u.id === selectedUser.id ? { ...u, ...formData } : u
      );
      onUpdateUsers(updatedUsers);
    } else {
      toast.error('Pembaruan pengguna tidak tersedia');
      return;
    }

    setIsEditDialogOpen(false);
    setSelectedUser(null);
    setFormData({});
    toast.success('Pengguna berhasil diperbarui.');
  };

  const confirmDeactivate = () => {
    if (!selectedUser) return;

    if (onToggleUserStatus) {
      onToggleUserStatus(selectedUser.id);
      setIsDeactivateDialogOpen(false);
      setSelectedUser(null);
      return;
    }

    if (!onUpdateUsers) {
      toast.error('Perubahan status pengguna tidak tersedia');
      return;
    }

    const newStatus: UserStatus = selectedUser.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    const updatedUsers = users.map((u) =>
      u.id === selectedUser.id ? { ...u, status: newStatus } : u
    );

    onUpdateUsers(updatedUsers);
    setIsDeactivateDialogOpen(false);
    setSelectedUser(null);
    toast.success(
      newStatus === 'Aktif'
        ? 'Pengguna berhasil diaktifkan.'
        : 'Pengguna berhasil dinonaktifkan.'
    );
  };

  const handleResetPassword = (user: User) => {
    toast.success(`Email reset kata sandi telah dikirim ke ${user.email}`);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Cari pengguna (nama, email, NIK)…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Peran" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Peran</SelectItem>
              <SelectItem value="Superadmin">Superadmin</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Verifikator">Verifikator</SelectItem>
              <SelectItem value="Viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="Aktif">Aktif</SelectItem>
              <SelectItem value="Nonaktif">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {canAddUser && (
          <Button onClick={handleAddUser} className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Tambah Pengguna
          </Button>
        )}
      </div>

      {/* Permission Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-blue-900 flex items-start gap-2">
          <span className="text-blue-600 mt-0.5">ℹ️</span>
          <span>
            <strong>Catatan Perizinan:</strong> Superadmin dapat mengelola semua data. Admin dapat
            mengelola desa dan kawasan non-SPPTG serta melihat pengguna. Verifikator dan Viewer hanya
            memiliki akses baca.
          </span>
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <SortableHead label="Nama" sortKey="nama" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="NIP/NIK" sortKey="nipNik" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Email" sortKey="email" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Peran" sortKey="peran" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <SortableHead label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <TableHead>Status Akun</TableHead>
              <SortableHead label="Terakhir Masuk" sortKey="terakhirMasuk" activeKey={sortKey} dir={sortDir} onSort={toggleSort} />
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                  Tidak ada pengguna yang ditemukan
                </TableCell>
              </TableRow>
            ) : (
              sortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.nama}</TableCell>
                  <TableCell className="text-gray-600">{user.nipNik}</TableCell>
                  <TableCell className="text-gray-600">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.peran === 'Superadmin'
                          ? 'border-purple-600 text-purple-700 bg-purple-50'
                          : user.peran === 'Admin'
                          ? 'border-blue-600 text-blue-700 bg-blue-50'
                          : user.peran === 'Verifikator'
                          ? 'border-green-600 text-green-700 bg-green-50'
                          : 'border-gray-600 text-gray-700 bg-gray-50'
                      }
                    >
                      {user.peran}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.status === 'Aktif' ? 'default' : 'secondary'}
                      className={
                        user.status === 'Aktif'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                      }
                    >
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.clerkUserId ? (
                      <Badge
                        variant="outline"
                        className="border-green-600 text-green-700 bg-green-50"
                      >
                        Terhubung
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 bg-amber-50"
                      >
                        Menunggu login
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-600 text-sm">
                    {formatDateTime(user.terakhirMasuk)}
                  </TableCell>
                  <TableCell className="text-right">
                    {currentUser && canManageUser(currentUser, user) ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivateUser(user)}
                          title={user.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetPassword(user)}
                          title="Reset Sandi"
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add User Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna</DialogTitle>
            <DialogDescription>
              Tambahkan pengguna baru ke sistem. Field bertanda (*) wajib diisi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Pengguna ditambahkan dengan status <strong>Menunggu login</strong>. Akun akan
              otomatis terhubung saat pengguna login pertama kali via Clerk menggunakan email
              yang sama. Email bisa memakai domain apa pun (tidak harus @gmail).
            </div>
            <div>
              <Label htmlFor="nama">Nama Lengkap<RequiredMark /></Label>
              <Input
                id="nama"
                value={formData.nama || ''}
                onChange={(e) => { setFormData({ ...formData, nama: e.target.value }); clearError('nama'); }}
                placeholder="Masukkan nama lengkap"
                className={errorClass('nama')}
              />
              <FieldError message={errors.nama} />
            </div>

            <div>
              <Label htmlFor="nipNik">NIP/NIK<RequiredMark /></Label>
              <Input
                id="nipNik"
                value={formData.nipNik || ''}
                onChange={(e) => { setFormData({ ...formData, nipNik: e.target.value }); clearError('nipNik'); }}
                placeholder="Masukkan NIP atau NIK"
                className={errorClass('nipNik')}
              />
              <FieldError message={errors.nipNik} />
            </div>

            <div>
              <Label htmlFor="email">Email<RequiredMark /></Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError('email'); }}
                placeholder="nama@pemda.go.id"
                className={errorClass('email')}
              />
              <FieldError message={errors.email} />
            </div>

            <div>
              <Label htmlFor="peran">Peran<RequiredMark /></Label>
              <Select
                value={formData.peran}
                onValueChange={(value) => {
                  clearError('peran');
                  setFormData({
                    ...formData,
                    peran: value as UserRole,
                    assignedVillageId:
                      value === 'Admin' || value === 'Verifikator'
                        ? formData.assignedVillageId ?? null
                        : null,
                  });
                }}
              >
                <SelectTrigger className={errorClass('peran')}>
                  <SelectValue placeholder="Pilih peran" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Superadmin" disabled={!canManageVillageAssignment}>
                    Superadmin
                  </SelectItem>
                  <SelectItem value="Admin" disabled={!canManageVillageAssignment}>
                    Admin
                  </SelectItem>
                  <SelectItem value="Verifikator" disabled={!canManageVillageAssignment}>
                    Verifikator
                  </SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.peran} />
            </div>

            {(formData.peran === 'Admin' || formData.peran === 'Verifikator') && (
              <div>
                <Label htmlFor="assignedVillageId">Desa Penugasan<RequiredMark /></Label>
                <SearchableSelect
                  id="assignedVillageId"
                  disabled={!canManageVillageAssignment}
                  value={
                    typeof formData.assignedVillageId === 'number'
                      ? String(formData.assignedVillageId)
                      : ''
                  }
                  onValueChange={(value) => {
                    clearError('assignedVillageId');
                    setFormData({ ...formData, assignedVillageId: Number(value) });
                  }}
                  placeholder="Pilih desa penugasan"
                  searchPlaceholder="Cari desa..."
                  className={errorClass('assignedVillageId')}
                  options={villages.map((village) => ({
                    value: String(village.id),
                    label: village.namaDesa,
                  }))}
                />
                <FieldError message={errors.assignedVillageId} />
                {!canManageVillageAssignment && (
                  <p className="mt-1 text-xs text-gray-500">
                    Hanya superadmin yang dapat mengubah penugasan desa.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="nomorHP">Nomor HP</Label>
              <Input
                id="nomorHP"
                value={formData.nomorHP || ''}
                onChange={(e) => setFormData({ ...formData, nomorHP: e.target.value })}
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSaveUser} className="bg-blue-600 hover:bg-blue-700">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
            <DialogDescription>Perbarui informasi pengguna.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-nama">Nama Lengkap<RequiredMark /></Label>
              <Input
                id="edit-nama"
                value={formData.nama || ''}
                onChange={(e) => { setFormData({ ...formData, nama: e.target.value }); clearError('nama'); }}
                className={errorClass('nama')}
              />
              <FieldError message={errors.nama} />
            </div>

            <div>
              <Label htmlFor="edit-nipNik">NIP/NIK<RequiredMark /></Label>
              <Input
                id="edit-nipNik"
                value={formData.nipNik || ''}
                onChange={(e) => { setFormData({ ...formData, nipNik: e.target.value }); clearError('nipNik'); }}
                className={errorClass('nipNik')}
              />
              <FieldError message={errors.nipNik} />
            </div>

            <div>
              <Label htmlFor="edit-email">Email<RequiredMark /></Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearError('email'); }}
                className={errorClass('email')}
              />
              <FieldError message={errors.email} />
            </div>

            <div>
              <Label htmlFor="edit-peran">Peran<RequiredMark /></Label>
              <Select
                value={formData.peran}
                onValueChange={(value) => {
                  clearError('peran');
                  setFormData({
                    ...formData,
                    peran: value as UserRole,
                    assignedVillageId:
                      value === 'Admin' || value === 'Verifikator'
                        ? formData.assignedVillageId ?? null
                        : null,
                  });
                }}
              >
                <SelectTrigger className={errorClass('peran')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Superadmin" disabled={!canManageVillageAssignment}>
                    Superadmin
                  </SelectItem>
                  <SelectItem value="Admin" disabled={!canManageVillageAssignment}>
                    Admin
                  </SelectItem>
                  <SelectItem value="Verifikator" disabled={!canManageVillageAssignment}>
                    Verifikator
                  </SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <FieldError message={errors.peran} />
            </div>

            {(formData.peran === 'Admin' || formData.peran === 'Verifikator') && (
              <div>
                <Label htmlFor="edit-assignedVillageId">Desa Penugasan<RequiredMark /></Label>
                <SearchableSelect
                  id="edit-assignedVillageId"
                  disabled={!canManageVillageAssignment}
                  value={
                    typeof formData.assignedVillageId === 'number'
                      ? String(formData.assignedVillageId)
                      : ''
                  }
                  onValueChange={(value) => {
                    clearError('assignedVillageId');
                    setFormData({ ...formData, assignedVillageId: Number(value) });
                  }}
                  placeholder="Pilih desa penugasan"
                  searchPlaceholder="Cari desa..."
                  className={errorClass('assignedVillageId')}
                  options={villages.map((village) => ({
                    value: String(village.id),
                    label: village.namaDesa,
                  }))}
                />
                <FieldError message={errors.assignedVillageId} />
                {!canManageVillageAssignment && (
                  <p className="mt-1 text-xs text-gray-500">
                    Hanya superadmin yang dapat mengubah penugasan desa.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="edit-nomorHP">Nomor HP</Label>
              <Input
                id="edit-nomorHP"
                value={formData.nomorHP || ''}
                onChange={(e) => setFormData({ ...formData, nomorHP: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateUser} className="bg-blue-600 hover:bg-blue-700">
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={isDeactivateDialogOpen} onOpenChange={setIsDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedUser?.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'} Pengguna?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.status === 'Aktif'
                ? `Nonaktifkan pengguna ${selectedUser?.nama}? Mereka tidak akan bisa masuk ke sistem.`
                : `Aktifkan kembali pengguna ${selectedUser?.nama}? Mereka akan dapat mengakses sistem sesuai peran mereka.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeactivate}
              className={
                selectedUser?.status === 'Aktif'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }
            >
              {selectedUser?.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
