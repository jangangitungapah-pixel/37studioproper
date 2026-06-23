import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase';
import { ShieldCheck, Home } from 'lucide-react';
import AccessState from '../../components/ui/AccessState';

function isOwnerAdminUser(user) {
  return user?.role === 'admin' && user?.permissions?.isOwner === true;
}

export default function AutoApprovePage({ currentUser, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('loading'); // 'loading' | 'confirm' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [targetUser, setTargetUser] = useState(null);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const targetUid = queryParams.get('uid');

  useEffect(() => {
    if (!targetUid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setErrorMsg('Tautan persetujuan tidak lengkap (UID tidak ditemukan).');
      return;
    }

    if (!isOwnerAdminUser(currentUser)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setErrorMsg('Hanya owner aktif yang diizinkan untuk menyetujui akun baru.');
      return;
    }

    async function loadTargetUser() {
      try {
        const userRef = doc(firestoreDb, 'users', targetUid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
      setStatus('error');
          setErrorMsg('Akun user yang ingin disetujui tidak ditemukan di database.');
          return;
        }

        const data = userSnap.data();
        setTargetUser(data);

        if (data.role !== 'admin') {
      setStatus('error');
          setErrorMsg('Akun ini tidak lagi memiliki request admin. Role client tidak dapat disetujui sebagai admin.');
          return;
        }

        if (data.status === 'approved') {
          setStatus('success');
          return;
        }

        if (data.status !== 'pending') {
      setStatus('error');
          setErrorMsg('Request admin akun ini sudah ditolak atau tidak aktif.');
          return;
        }

        setStatus('confirm');
      } catch (err) {
        console.error('Failed to load approval target:', err);
      setStatus('error');
        setErrorMsg('Gagal memuat user dari Firestore. Periksa koneksi atau database.');
      }
    }

    loadTargetUser();
  }, [targetUid, currentUser]);

  async function approveTargetUser() {
    if (!targetUid) return;

    try {
      await updateDoc(doc(firestoreDb, 'users', targetUid), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });

      setTargetUser((current) => current ? { ...current, status: 'approved' } : current);
      setStatus('success');
    } catch (err) {
      console.error('Failed to approve user:', err);
      setStatus('error');
      setErrorMsg('Gagal menyetujui user di Firestore. Periksa koneksi atau database.');
    }
  }

  if (status === 'loading') {
    return (
      <AccessState
        isLoadingIcon={true}
        iconColorClass="text-accent"
        title="Memuat Persetujuan..."
        description="Sistem sedang memverifikasi akun baru."
      />
    );
  }

  if (status === 'confirm') {
    return (
      <AccessState
        icon={ShieldCheck}
        statusLabel="Konfirmasi"
        statusType="neutral"
        title="Setujui Akun Ini?"
        description={
          <>
            Akun <strong>{targetUser?.displayName || targetUser?.email || 'User'}</strong> ({targetUser?.email || targetUser?.phoneNumber || 'No HP'}) akan diberi akses admin.
          </>
        }
        primaryAction={{
          label: (
            <>
              <ShieldCheck size={16} />
              <span>Setujui Akun</span>
            </>
          ),
          onClick: approveTargetUser,
          variant: 'primary'
        }}
        secondaryAction={{
          label: 'Batal',
          onClick: () => navigate('/admin/settings'),
          variant: 'secondary'
        }}
      />
    );
  }

  if (status === 'success') {
    return (
      <AccessState
        icon={ShieldCheck}
        statusLabel="Sukses"
        statusType="approved"
        title="Persetujuan Berhasil"
        description={
          <>
            Akun <strong>{targetUser?.displayName || targetUser?.email || 'User'}</strong> ({targetUser?.email || targetUser?.phoneNumber || 'No HP'}) sekarang sudah aktif dan dapat mengakses Scheduler.
          </>
        }
        primaryAction={{
          label: (
            <>
              <Home size={16} />
              <span>Ke Dashboard</span>
            </>
          ),
          onClick: () => navigate('/admin/dashboard'),
          variant: 'primary'
        }}
      />
    );
  }

  if (status === 'error') {
    return (
      <AccessState
        statusLabel="Gagal"
        statusType="rejected"
        title="Gagal Menyetujui"
        alertMessage={errorMsg}
        primaryAction={
          !isOwnerAdminUser(currentUser)
            ? {
                label: 'Keluar & Login Sebagai Owner',
                onClick: onLogout,
                variant: 'danger'
              }
            : {
                label: 'Kembali ke Dashboard',
                onClick: () => navigate('/admin/dashboard'),
                variant: 'secondary'
              }
        }
      />
    );
  }

  return null;
}

