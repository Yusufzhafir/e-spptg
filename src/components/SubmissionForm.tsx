import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MapView } from './MapView';
import { ChevronLeft, ChevronRight, Save, Send, Upload } from 'lucide-react';
import { Submission } from '../types';
import { toast } from 'sonner';

interface SubmissionFormProps {
  onSubmit: (data: Partial<Submission>) => void;
  onCancel: () => void;
}

export function SubmissionForm({ onSubmit, onCancel }: SubmissionFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Submission>>({
    namaPemilik: '',
    nik: '',
    alamat: '',
    nomorHP: '',
    email: '',
    villageId: 0,
    kecamatan: '',
    kabupaten: 'Cirebon',
    luas: 0,
    penggunaanLahan: '',
    catatan: '',
    geoJSON: [],
  });

   
  const updateField = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handlePrevious = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSaveDraft = () => {
    toast.success('Draft berhasil disimpan');
  };

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.namaPemilik || !formData.nik || !formData.villageId || !formData.luas) {
      toast.error('Mohon lengkapi semua data yang wajib diisi');
      return;
    }
    
    onSubmit(formData);
    toast.success('Pengajuan SPPTG berhasil diajukan');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" onClick={onCancel}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          Kembali ke Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pengajuan Plot Lahan Baru</CardTitle>
          <div className="flex items-center gap-4 mt-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-2 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    step >= num ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {num}
                </div>
                <span className={`text-sm ${step >= num ? 'text-blue-600' : 'text-gray-600'}`}>
                  {num === 1 && 'Data Pemilik'}
                  {num === 2 && 'Data Lahan'}
                  {num === 3 && 'Peta & Dokumen'}
                </span>
                {num < 3 && <div className="flex-1 h-0.5 bg-gray-200 ml-2" />}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Step 1: Data Pemilik */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="namaPemilik">Nama Pemilik *</Label>
                  <Input
                    id="namaPemilik"
                    value={formData.namaPemilik}
                    onChange={(e) => updateField('namaPemilik', e.target.value)}
                    placeholder="Masukkan nama lengkap"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nik">NIK *</Label>
                  <Input
                    id="nik"
                    value={formData.nik}
                    onChange={(e) => updateField('nik', e.target.value)}
                    placeholder="16 digit NIK"
                    maxLength={16}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alamat">Alamat *</Label>
                <Textarea
                  id="alamat"
                  value={formData.alamat}
                  onChange={(e) => updateField('alamat', e.target.value)}
                  placeholder="Masukkan alamat lengkap"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nomorHP">Nomor HP *</Label>
                  <Input
                    id="nomorHP"
                    value={formData.nomorHP}
                    onChange={(e) => updateField('nomorHP', e.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="email@contoh.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Data Lahan */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="desa">Desa *</Label>
                  <Input
                    id="desa"
                    value={formData.villageId}
                    onChange={(e) => updateField('desa', e.target.value)}
                    placeholder="Nama desa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kecamatan">Kecamatan *</Label>
                  <Select value={formData.kecamatan} onValueChange={(v) => updateField('kecamatan', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kecamatan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sukasari">Sukasari</SelectItem>
                      <SelectItem value="Lemahwungkuk">Lemahwungkuk</SelectItem>
                      <SelectItem value="Harjamukti">Harjamukti</SelectItem>
                      <SelectItem value="Kejaksan">Kejaksan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kabupaten">Kabupaten *</Label>
                  <Input id="kabupaten" value="Cirebon" disabled />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="luas">Luas (m²) *</Label>
                  <Input
                    id="luas"
                    type="number"
                    value={formData.luas}
                    onChange={(e) => updateField('luas', parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 1250"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="penggunaanLahan">Penggunaan Lahan *</Label>
                  <Select
                    value={formData.penggunaanLahan}
                    onValueChange={(v) => updateField('penggunaanLahan', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih penggunaan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pertanian">Pertanian</SelectItem>
                      <SelectItem value="Perumahan">Perumahan</SelectItem>
                      <SelectItem value="Perkebunan">Perkebunan</SelectItem>
                      <SelectItem value="Komersial">Komersial</SelectItem>
                      <SelectItem value="Industri">Industri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="catatan">Catatan Tambahan</Label>
                <Textarea
                  id="catatan"
                  value={formData.villageId}
                  onChange={(e) => updateField('catatan', e.target.value)}
                  placeholder="Masukkan catatan jika diperlukan"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 3: Peta & Dokumen */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Plotting Lahan pada Peta</Label>
                <p className="text-sm text-gray-600 mb-2">
                  Gunakan alat gambar di bawah untuk menandai lokasi lahan Anda
                </p>
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex gap-2 mb-3">
                    <Button variant="outline" size="sm">
                      Gambar Polygon
                    </Button>
                    <Button variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Unggah GeoJSON
                    </Button>
                  </div>
                  <MapView
                    submissions={[]}
                    height="350px"
                    center={{ lat: -6.7100, lng: 108.5550 }}
                    zoom={13}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dokumen">Bukti Dokumen (PDF/JPG)</Label>
                <Input id="dokumen" type="file" accept=".pdf,.jpg,.jpeg,.png" />
                <p className="text-xs text-gray-500">
                  Unggah bukti kepemilikan atau dokumen pendukung lainnya (maksimal 5 MB)
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6 border-t">
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="outline" onClick={handlePrevious}>
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Sebelumnya
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Batal
              </Button>
              <Button variant="outline" onClick={handleSaveDraft}>
                <Save className="w-4 h-4 mr-2" />
                Simpan Draf
              </Button>
              {step < 3 ? (
                <Button onClick={handleNext}>
                  Selanjutnya
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit}>
                  <Send className="w-4 h-4 mr-2" />
                  Ajukan
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
