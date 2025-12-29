'use client';

import { Map, FileText, CheckSquare, BarChart3, Shield, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const features = [
  {
    icon: FileText,
    title: 'Pengajuan Digital',
    description: 'Proses pengajuan SPPTG secara digital yang mudah dan efisien.',
  },
  {
    icon: Map,
    title: 'Pemetaan Lahan',
    description: 'Visualisasi peta interaktif untuk melihat sebaran lahan yang diajukan.',
  },
  {
    icon: CheckSquare,
    title: 'Verifikasi Otomatis',
    description: 'Validasi dokumen dan koordinat secara otomatis untuk mempercepat proses.',
  },
  {
    icon: BarChart3,
    title: 'Laporan & Analitik',
    description: 'Pantau statistik dan tren pengajuan dengan dashboard yang informatif.',
  },
  {
    icon: Shield,
    title: 'Keamanan Data',
    description: 'Data tersimpan dengan aman dan terenkripsi sesuai standar keamanan.',
  },
  {
    icon: Users,
    title: 'Manajemen Pengguna',
    description: 'Kelola akses dan peran pengguna dengan sistem yang terintegrasi.',
  },
];

export function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Map className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">SPPTG Dashboard</h1>
                <p className="text-xs text-gray-500">Pemerintah Daerah</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SignedOut>
                <SignInButton mode="modal">
                  <Button variant="ghost">Masuk</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button className="bg-blue-600 hover:bg-blue-700">Daftar</Button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <Button onClick={() => router.push('/app')} className="bg-blue-600 hover:bg-blue-700">
                  Buka Dashboard
                </Button>
              </SignedIn>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Sistem Pendaftaran & Pengelolaan
            <span className="text-blue-600 block mt-2">Tanah Girik (SPPTG)</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Platform digital untuk memudahkan proses pendaftaran, verifikasi, dan pengelolaan 
            Surat Keterangan Tanah (SKT) bagi masyarakat dan pemerintah daerah.
          </p>
          <div className="flex items-center justify-center gap-4">
            <SignedOut>
              <SignInButton mode="modal">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
                  Mulai Sekarang
                </Button>
              </SignInButton>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Pelajari Lebih Lanjut
              </Button>
            </SignedOut>
            <SignedIn>
              <Button 
                size="lg" 
                onClick={() => router.push('/app')} 
                className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6"
              >
                Buka Dashboard
              </Button>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">Fitur Unggulan</h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Nikmati berbagai fitur yang dirancang untuk mempermudah proses pengelolaan SPPTG
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h4>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-white mb-4">
            Siap untuk Memulai?
          </h3>
          <p className="text-blue-100 max-w-2xl mx-auto mb-8">
            Daftarkan akun Anda sekarang dan mulai kelola pengajuan SPPTG dengan lebih efisien.
          </p>
          <SignedOut>
            <SignUpButton mode="modal">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6">
                Daftar Gratis
              </Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Button 
              size="lg" 
              variant="secondary" 
              onClick={() => router.push('/app')} 
              className="text-lg px-8 py-6"
            >
              Buka Dashboard
            </Button>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Map className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold">SPPTG Dashboard</span>
            </div>
            <p className="text-sm">
              &copy; {new Date().getFullYear()} Pemerintah Daerah. Hak Cipta Dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
